'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { useFormattedUTXOs } from '@/hooks/use-formatted-utxos'
import { FeeSelector } from '@/components/fee-selector'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { createOpReturnScript, estimateOpReturnTxSize, calculateOpReturnFee } from '@/lib/opreturn-utils'
import { getUTXOsForUseCase } from '@/lib/utxo-selector'
import { createOpReturn } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'

export default function OpReturnPage() {
  const { address, connected, client, signPsbt } = useLaserEyes()
  const { createPSBTTransaction, finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  const { utxos, loading: utxosLoading } = useFormattedUTXOs()
  
  const [data, setData] = useState('')
  const [encoding, setEncoding] = useState<'utf-8' | 'hex'>('utf-8')
  const [feeRate, setFeeRate] = useState(2)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [loading, setLoading] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState(0)
  const [estimatedSize, setEstimatedSize] = useState(0)

  // Calculate estimated fee
  useEffect(() => {
    if (data && utxos) {
      try {
        const dataSize = encoding === 'hex' 
          ? data.replace(/\s+/g, '').length / 2
          : Buffer.from(data, 'utf-8').length
        
        if (dataSize > 80) {
          setEstimatedFee(0)
          setEstimatedSize(0)
          return
        }

        // Estimate with 1 input and potential change output
        const inputCount = 1
        const hasChange = true
        const size = estimateOpReturnTxSize(inputCount, hasChange, dataSize)
        const fee = calculateOpReturnFee(inputCount, hasChange, dataSize, feeRate)
        
        setEstimatedSize(size)
        setEstimatedFee(fee)
      } catch (error) {
        setEstimatedFee(0)
        setEstimatedSize(0)
      }
    } else {
      setEstimatedFee(0)
      setEstimatedSize(0)
    }
  }, [data, encoding, feeRate, utxos])

  const handleCreateOpReturn = async () => {
    if (!data.trim()) {
      toast.error('Please enter data for OP_RETURN')
      return
    }

    if (!connected || !address || !client) {
      toast.error('Wallet not connected')
      return
    }

    if (!utxos || utxos.length === 0) {
      toast.error('No UTXOs available')
      return
    }

    setLoading(true)

    try {
      // Encode OP_RETURN data
      const opReturnScript = createOpReturnScript(data.trim(), encoding)
      
      // Get network from client
      const network = client.$network.get()
      const bitcoinNetwork = getBitcoinNetwork(network)

      // Select payment UTXO (from paymentAddress, >601 sats, confirmed, largest first)
      const paymentUtxos = await getUTXOsForUseCase(client, 'payment', {
        minValue: 601,
        requiredConfirmations: 1,
        sortOrder: 'largest-first',
        limit: 1,
      })
      
      if (paymentUtxos.length === 0) {
        throw new Error('No confirmed payment UTXOs available (value > 601 sats)')
      }

      const selectedUtxo = paymentUtxos[0]

      // Calculate fee
      const dataSize = encoding === 'hex' 
        ? data.replace(/\s+/g, '').length / 2
        : Buffer.from(data, 'utf-8').length
      const hasChange = selectedUtxo.btcValue > estimatedFee + 546
      const fee = calculateOpReturnFee(1, hasChange, dataSize, feeRate)

      // Build PSBT manually using bitcoinjs-lib
      const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

      // Add input
      const scriptPubKey = Buffer.from(selectedUtxo.scriptPubKey, 'hex')
      psbt.addInput({
        hash: selectedUtxo.txHash,
        index: selectedUtxo.txOutputIndex,
        witnessUtxo: {
          value: BigInt(selectedUtxo.btcValue),
          script: scriptPubKey,
        },
        tapInternalKey: selectedUtxo.tapInternalKey 
          ? Buffer.from(selectedUtxo.tapInternalKey, 'hex')
          : undefined,
      })

      // Add OP_RETURN output
      psbt.addOutput({
        script: opReturnScript,
        value: 0n,
      })

      // Add change output if needed
      const change = selectedUtxo.btcValue - fee
      if (change > 546) {
        psbt.addOutput({
          address: address,
          value: BigInt(change),
        })
      } else if (change < 0) {
        throw new Error('Insufficient balance for fee')
      }

      // Convert to base64 for signing
      const psbtBase64 = psbt.toBase64()

      // Sign PSBT
      const signedResponse = await signPsbt(psbtBase64, false, false)
      if (!signedResponse?.signedPsbtBase64) {
        throw new Error('Failed to sign PSBT')
      }

      // Finalize PSBT
      const finalized = await finalizePSBTTransaction(signedResponse.signedPsbtBase64, true)
      if (!finalized.hex) {
        throw new Error('Failed to finalize PSBT')
      }

      let broadcastTxId: string | null = null

      // Broadcast transaction
      if (broadcastMethod === 'mempool' || broadcastMethod === 'mara_slipstream') {
        broadcastTxId = await broadcastTransaction(finalized.hex)
      }

      // Save to database
      await createOpReturn({
        user_address: address,
        data: data.trim(),
        data_encoding: encoding,
        fee_rate: feeRate,
        broadcast_method: broadcastMethod,
        tx_id: broadcastTxId,
        status: broadcastTxId ? 'broadcasting' : 'signed',
        network: network || 'mainnet',
      })

      toast.success(
        broadcastTxId
          ? `OP_RETURN transaction created! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Transaction signed. Broadcast manually.'
      )

      // Reset form
      setData('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create OP_RETURN transaction')
      console.error('OP_RETURN error:', error)
    } finally {
      setLoading(false)
    }
  }

  const dataSize = data && encoding === 'utf-8' 
    ? Buffer.from(data, 'utf-8').length
    : data 
      ? data.replace(/\s+/g, '').length / 2
      : 0

  const isDataTooLarge = dataSize > 80

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">OP_RETURN</h1>
        <p className="text-muted-foreground">
          Create a transaction with an OP_RETURN containing arbitrary data
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>OP_RETURN Data</CardTitle>
          <CardDescription>
            Enter the data you want to store in the OP_RETURN output (max 80 bytes)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              placeholder="Enter OP_RETURN data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="font-mono mt-1"
            />
            {data && (
              <div className="text-sm text-muted-foreground mt-1">
                Size: {dataSize} bytes {isDataTooLarge && <span className="text-red-500">(exceeds 80 byte limit)</span>}
              </div>
            )}
          </div>

          <div>
            <Label>Data Encoding</Label>
            <RadioGroup value={encoding} onValueChange={(v) => setEncoding(v as 'utf-8' | 'hex')} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="utf-8" id="utf8" />
                <Label htmlFor="utf8" className="font-normal cursor-pointer">UTF-8 (text)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hex" id="hex" />
                <Label htmlFor="hex" className="font-normal cursor-pointer">Hex (binary)</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <FeeSelector feeRate={feeRate} onChange={setFeeRate} />

      {estimatedFee > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Transaction Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Estimated Size</div>
                <div className="text-lg font-semibold">{estimatedSize} vBytes</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Estimated Fee</div>
                <div className="text-lg font-semibold">{formatSats(estimatedFee)} sats</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <BroadcastMethodSelector
        method={broadcastMethod}
        onChange={setBroadcastMethod}
      />

      <Button
        onClick={handleCreateOpReturn}
        disabled={loading || !connected || !data.trim() || isDataTooLarge || !utxos || utxos.length === 0}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating Transaction...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Create OP_RETURN Transaction
          </>
        )}
      </Button>

      {!connected && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to create OP_RETURN transactions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
