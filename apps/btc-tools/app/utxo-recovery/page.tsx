'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { useFormattedUTXOs } from '@/hooks/use-formatted-utxos'
import { FeeSelector } from '@/components/fee-selector'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { createTransaction } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { calculateRecoveryFee, calculateDestinationAmount, getAddressType } from '@/lib/utxo-recovery-utils'
import { Send, Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371'
import { getRecommendedFeeRate } from '@/lib/sandshrew-esplora'
import type { FormattedUTXO } from '@omnisat/lasereyes-core'

export default function UTXORecoveryPage() {
  const { address, connected, client, signPsbt, paymentAddress, network, publicKey, paymentPublicKey } = useLaserEyes()
  const { finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  const { utxos, loading: utxosLoading } = useFormattedUTXOs()
  
  const [selectedUTXO, setSelectedUTXO] = useState<FormattedUTXO | null>(null)
  const [destinationAddress, setDestinationAddress] = useState('')
  const [feeRate, setFeeRate] = useState(2)
  const [recommendedFeeRate, setRecommendedFeeRate] = useState<number | null>(null)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [loading, setLoading] = useState(false)
  const [addressFilter, setAddressFilter] = useState<'all' | 'payment' | 'ordinals'>('all')

  // Get recommended fee rate
  useEffect(() => {
    if (client && connected) {
      getRecommendedFeeRate(client).then(rate => {
        setRecommendedFeeRate(rate)
        setFeeRate(rate)
      }).catch(() => {
        // Ignore errors
      })
    }
  }, [client, connected])

  // Filter UTXOs > 600 sats
  const largeUTXOs = (utxos || []).filter(utxo => {
    const valueCheck = utxo.btcValue > 600
    const addressCheck = 
      addressFilter === 'all' ||
      (addressFilter === 'payment' && utxo.address === paymentAddress) ||
      (addressFilter === 'ordinals' && utxo.address === address && utxo.address !== paymentAddress)
    return valueCheck && addressCheck
  })

  // Separate by address
  const paymentUTXOs = largeUTXOs.filter(utxo => utxo.address === paymentAddress)
  const ordinalsUTXOs = largeUTXOs.filter(utxo => utxo.address === address && utxo.address !== paymentAddress)

  // Calculate fee and destination amount
  const feeCalculation = selectedUTXO && destinationAddress && network
    ? calculateRecoveryFee(
        selectedUTXO.address,
        destinationAddress,
        feeRate,
        network
      )
    : null

  const destinationAmount = selectedUTXO && feeCalculation
    ? calculateDestinationAmount(selectedUTXO.btcValue, feeCalculation.fee)
    : null

  const handleRecover = async () => {
    if (!selectedUTXO || !destinationAddress || !client || !address || !network) {
      toast.error('Please select a UTXO and enter destination address')
      return
    }

    if (!feeCalculation || !destinationAmount) {
      toast.error('Failed to calculate fee')
      return
    }

    if (destinationAmount.destinationAmount < 546) {
      toast.error(`Destination amount (${formatSats(destinationAmount.destinationAmount)} sats) is below dust limit (546 sats)`)
      return
    }

    setLoading(true)

    try {
      const bitcoinNetwork = getBitcoinNetwork(network)
      const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

      // Add input
      const scriptPubKey = Buffer.from(selectedUTXO.scriptPubKey, 'hex')
      const inputOptions: any = {
        hash: selectedUTXO.txHash,
        index: selectedUTXO.txOutputIndex,
        witnessUtxo: {
          value: BigInt(selectedUTXO.btcValue),
          script: scriptPubKey,
        },
      }

      // Add tapInternalKey for P2TR addresses
      const addressType = getAddressType(selectedUTXO.address, network)
      if (addressType === 'p2tr') {
        // Use the appropriate public key based on which address the UTXO is from
        const pubKey = selectedUTXO.address === paymentAddress && paymentPublicKey
          ? paymentPublicKey
          : selectedUTXO.address === address && publicKey
          ? publicKey
          : null
        
        if (pubKey) {
          inputOptions.tapInternalKey = toXOnly(Buffer.from(pubKey, 'hex'))
        }
      }

      psbt.addInput(inputOptions)

      // Add output (destination with remaining amount after fee)
      psbt.addOutput({
        address: destinationAddress,
        value: BigInt(destinationAmount.destinationAmount),
      })

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
      await createTransaction({
        user_address: address,
        tool_type: 'utxo_recovery',
        status: broadcastTxId ? 'broadcasting' : 'signed',
        tx_id: broadcastTxId,
        psbt_hex: finalized.hex,
        psbt_base64: signedResponse.signedPsbtBase64,
        fee_rate: feeRate,
        broadcast_method: broadcastMethod,
        network: network,
        metadata: {
          source_address: selectedUTXO.address,
          destination_address: destinationAddress,
          utxo_value: selectedUTXO.btcValue,
          fee: feeCalculation.fee,
          destination_amount: destinationAmount.destinationAmount,
          vbytes: feeCalculation.vBytes,
        },
      })

      toast.success(
        broadcastTxId
          ? `UTXO recovered! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Transaction signed. Broadcast manually.'
      )

      // Reset
      setSelectedUTXO(null)
      setDestinationAddress('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to recover UTXO')
      console.error('Recovery error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔄 UTXO Recovery</h1>
        <p className="text-muted-foreground">
          Move large UTXOs (>600 sats) between your payment and ordinals addresses
        </p>
      </div>

      {!connected ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to recover UTXOs
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Available UTXOs</CardTitle>
                  <CardDescription>
                    Select a UTXO to recover (showing UTXOs &gt; 600 sats)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={addressFilter}
                    onChange={(e) => setAddressFilter(e.target.value as 'all' | 'payment' | 'ordinals')}
                    className="px-3 py-1.5 border rounded-md text-sm"
                  >
                    <option value="all">All Addresses</option>
                    <option value="payment">Payment Address</option>
                    <option value="ordinals">Ordinals Address</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {utxosLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading UTXOs...</p>
                </div>
              ) : largeUTXOs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No UTXOs found with value &gt; 600 sats</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentUTXOs.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Payment Address ({paymentUTXOs.length})
                      </div>
                      <div className="space-y-2">
                        {paymentUTXOs.map((utxo) => {
                          const isSelected = selectedUTXO?.txHash === utxo.txHash && 
                                           selectedUTXO?.txOutputIndex === utxo.txOutputIndex
                          return (
                            <div
                              key={`${utxo.txHash}-${utxo.txOutputIndex}`}
                              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : 'hover:bg-accent'
                              }`}
                              onClick={() => setSelectedUTXO(utxo)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium mb-1">
                                    {formatSats(utxo.btcValue)} sats
                                  </div>
                                  <div className="text-sm font-mono text-muted-foreground">
                                    {truncateString(String(utxo.txHash), 16)}:{utxo.txOutputIndex}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {utxo.confirmations !== undefined 
                                      ? `${utxo.confirmations} confirmations`
                                      : 'Unconfirmed'}
                                  </div>
                                </div>
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => setSelectedUTXO(utxo)}
                                  className="cursor-pointer"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {ordinalsUTXOs.length > 0 && (
                    <div className={paymentUTXOs.length > 0 ? 'mt-4 pt-4 border-t' : ''}>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Ordinals Address ({ordinalsUTXOs.length})
                      </div>
                      <div className="space-y-2">
                        {ordinalsUTXOs.map((utxo) => {
                          const isSelected = selectedUTXO?.txHash === utxo.txHash && 
                                           selectedUTXO?.txOutputIndex === utxo.txOutputIndex
                          return (
                            <div
                              key={`${utxo.txHash}-${utxo.txOutputIndex}`}
                              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : 'hover:bg-accent'
                              }`}
                              onClick={() => setSelectedUTXO(utxo)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium mb-1">
                                    {formatSats(utxo.btcValue)} sats
                                  </div>
                                  <div className="text-sm font-mono text-muted-foreground">
                                    {truncateString(String(utxo.txHash), 16)}:{utxo.txOutputIndex}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {utxo.confirmations !== undefined 
                                      ? `${utxo.confirmations} confirmations`
                                      : 'Unconfirmed'}
                                  </div>
                                </div>
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => setSelectedUTXO(utxo)}
                                  className="cursor-pointer"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedUTXO && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Recovery Details</CardTitle>
                  <CardDescription>
                    Enter destination address and review transaction details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="destination">Destination Address</Label>
                    <Input
                      id="destination"
                      placeholder="Enter destination Bitcoin address"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      className="font-mono mt-1"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Selected UTXO: {formatSats(selectedUTXO.btcValue)} sats from {truncateString(String(selectedUTXO.address), 20)}
                    </div>
                  </div>

                  {destinationAddress && feeCalculation && destinationAmount && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">UTXO Value</div>
                            <div className="text-lg font-semibold">{formatSats(selectedUTXO.btcValue)} sats</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Transaction Size</div>
                            <div className="text-lg font-semibold">{feeCalculation.vBytes} vBytes</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Fee Rate</div>
                            <div className="text-lg font-semibold">{feeRate} sat/vB</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Fee</div>
                            <div className="text-lg font-semibold text-orange-600">{formatSats(feeCalculation.fee)} sats</div>
                          </div>
                        </div>
                        <div className="pt-3 border-t">
                          <div className="text-sm text-muted-foreground mb-1">Destination Amount</div>
                          <div className={`text-2xl font-bold ${
                            destinationAmount.destinationAmount < 546 
                              ? 'text-red-500' 
                              : 'text-green-600'
                          }`}>
                            {formatSats(destinationAmount.destinationAmount)} sats
                          </div>
                          {destinationAmount.destinationAmount < 546 && (
                            <div className="text-xs text-red-500 mt-1">
                              ⚠️ Below dust limit (546 sats minimum)
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Fee calculation: {feeRate} sat/vB × {feeCalculation.vBytes} vBytes = {formatSats(feeCalculation.fee)} sats
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {destinationAddress && (
                <>
                  <Card className="mb-6">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Fee Rate</CardTitle>
                          <CardDescription>
                            {recommendedFeeRate 
                              ? `Recommended: ${recommendedFeeRate} sat/vB (auto-selected)`
                              : 'Adjust fee rate to control transaction speed'}
                          </CardDescription>
                        </div>
                        {recommendedFeeRate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFeeRate(recommendedFeeRate)}
                          >
                            Use Recommended ({recommendedFeeRate} sat/vB)
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <FeeSelector feeRate={feeRate} onChange={setFeeRate} />
                    </CardContent>
                  </Card>

                  <BroadcastMethodSelector
                    method={broadcastMethod}
                    onChange={setBroadcastMethod}
                  />

                  <Button
                    onClick={handleRecover}
                    disabled={loading || !destinationAddress || !selectedUTXO || (destinationAmount?.destinationAmount || 0) < 546}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Recover UTXO
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

