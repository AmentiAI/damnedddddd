'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { useFormattedUTXOs } from '@/hooks/use-formatted-utxos'
import { FeeSelector } from '@/components/fee-selector'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { createTxBuilderRecord } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { estimateTransactionSize, calculateFee } from '@/lib/fee-calculator'
import { getRecommendedFeeRate } from '@/lib/sandshrew-esplora'
import { calculateRecoveryFee } from '@/lib/utxo-recovery-utils'
import { toast } from 'sonner'
import { Plus, X, Loader2, Send, RefreshCw } from 'lucide-react'
import type { FormattedUTXO } from '@omnisat/lasereyes-core'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371'
import { createOpReturnScript } from '@/lib/opreturn-utils'

interface Output {
  address: string
  amount: number
  type: 'standard' | 'op_return'
  data?: string
  encoding?: 'utf-8' | 'hex'
}

export default function TxBuilderPage() {
  const { address, connected, client, signPsbt, paymentAddress, network, publicKey, paymentPublicKey } = useLaserEyes()
  const { finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  const { utxos, loading: utxosLoading, refetch } = useFormattedUTXOs()
  
  const [selectedUTXOs, setSelectedUTXOs] = useState<Set<string>>(new Set())
  const [outputs, setOutputs] = useState<Output[]>([])
  const [feeRate, setFeeRate] = useState(2)
  const [recommendedFeeRate, setRecommendedFeeRate] = useState<number | null>(null)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [loading, setLoading] = useState(false)
  const [utxoFilter, setUtxoFilter] = useState<'all' | 'cardinal' | 'inscription' | 'rune'>('all')
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

  // Filter UTXOs
  const filteredUTXOs = (utxos || []).filter(utxo => {
    const typeCheck = 
      utxoFilter === 'all' ||
      (utxoFilter === 'cardinal' && !utxo.hasInscriptions && !utxo.hasRunes && !utxo.hasAlkanes) ||
      (utxoFilter === 'inscription' && utxo.hasInscriptions) ||
      (utxoFilter === 'rune' && (utxo.hasRunes || utxo.hasAlkanes))
    
    const addressCheck = 
      addressFilter === 'all' ||
      (addressFilter === 'payment' && utxo.address === paymentAddress) ||
      (addressFilter === 'ordinals' && utxo.address === address && utxo.address !== paymentAddress)
    
    return typeCheck && addressCheck
  })

  // Get selected UTXO objects
  const selectedUTXOObjects = filteredUTXOs.filter(utxo => 
    selectedUTXOs.has(`${utxo.txHash}-${utxo.txOutputIndex}`)
  )

  // Calculate totals
  const totalInput = selectedUTXOObjects.reduce((sum, utxo) => sum + utxo.btcValue, 0)
  const totalOutput = outputs.reduce((sum, out) => sum + (out.amount || 0), 0)
  
  // Calculate accurate fee based on address types
  const calculateAccurateFee = () => {
    if (selectedUTXOObjects.length === 0 || outputs.length === 0 || !network) {
      return { vBytes: 0, fee: 0 }
    }

    // Use first UTXO address type for input (most common case)
    const inputAddress = selectedUTXOObjects[0].address
    // Use first output address type (or payment address for change)
    const outputAddress = outputs[0]?.address || paymentAddress || address || ''
    
    if (!outputAddress) {
      return { vBytes: 0, fee: 0 }
    }

    try {
      const feeCalc = calculateRecoveryFee(inputAddress, outputAddress, feeRate, network)
      // Adjust for multiple inputs/outputs
      const baseVBytes = feeCalc.vBytes
      const additionalInputs = selectedUTXOObjects.length - 1
      const additionalOutputs = outputs.length - 1
      const changeOutput = totalInput - totalOutput - feeCalc.fee > 546 ? 1 : 0
      
      // Estimate additional vBytes (simplified - assumes same address types)
      const inputVBytes = feeCalc.vBytes - 43 // Subtract one output
      const outputVBytes = 43 // P2TR output size
      const totalVBytes = baseVBytes + (additionalInputs * inputVBytes) + (additionalOutputs * outputVBytes) + (changeOutput * outputVBytes)
      const fee = Math.ceil(feeRate * totalVBytes)
      
      return { vBytes: totalVBytes, fee }
    } catch {
      // Fallback to simple estimation
      const inputCount = selectedUTXOObjects.length
      const outputCount = outputs.length + (totalInput - totalOutput > 546 ? 1 : 0)
      const sizeEstimate = estimateTransactionSize(inputCount, outputCount)
      const fee = calculateFee(feeRate, sizeEstimate.totalVBytes)
      return { vBytes: sizeEstimate.totalVBytes, fee }
    }
  }

  const { vBytes, fee } = calculateAccurateFee()
  const changeAmount = totalInput - totalOutput - fee

  const handleToggleUTXO = (utxo: FormattedUTXO) => {
    const key = `${utxo.txHash}-${utxo.txOutputIndex}`
    const newSelected = new Set(selectedUTXOs)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedUTXOs(newSelected)
  }

  const handleAddOutput = () => {
    setOutputs([...outputs, { address: '', amount: 0, type: 'standard' }])
  }

  const handleRemoveOutput = (index: number) => {
    setOutputs(outputs.filter((_, i) => i !== index))
  }

  const handleUpdateOutput = (index: number, field: keyof Output, value: any) => {
    const newOutputs = [...outputs]
    newOutputs[index] = { ...newOutputs[index], [field]: value }
    setOutputs(newOutputs)
  }

  const canBuild = 
    selectedUTXOObjects.length > 0 && 
    outputs.length > 0 && 
    outputs.every(out => out.type === 'standard' ? out.address && out.amount > 0 : out.data) &&
    changeAmount >= 0

  const handleBuild = async () => {
    if (!connected || !address || !client || !network) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!canBuild) {
      toast.error('Please complete all required fields')
      return
    }

    setLoading(true)
    try {
      const bitcoinNetwork = getBitcoinNetwork(network)
      const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

      // Add inputs
      for (const utxo of selectedUTXOObjects) {
        const scriptPubKey = Buffer.from(utxo.scriptPubKey, 'hex')
        const inputOptions: any = {
          hash: utxo.txHash,
          index: utxo.txOutputIndex,
          witnessUtxo: {
            value: BigInt(utxo.btcValue),
            script: scriptPubKey,
          },
        }

        // Add tapInternalKey for P2TR addresses
        const isPaymentAddress = utxo.address === paymentAddress
        const pubKey = isPaymentAddress && paymentPublicKey
          ? paymentPublicKey
          : utxo.address === address && publicKey
          ? publicKey
          : null

        if (pubKey && (utxo.address.startsWith('bc1p') || utxo.address.startsWith('tb1p'))) {
          inputOptions.tapInternalKey = toXOnly(Buffer.from(pubKey, 'hex'))
        }

        psbt.addInput(inputOptions)
      }

      // Add outputs
      for (const output of outputs) {
        if (output.type === 'standard') {
          if (!output.address || !output.amount) continue
          psbt.addOutput({
            address: output.address,
            value: BigInt(output.amount),
          })
        } else if (output.type === 'op_return') {
          if (!output.data) continue
          const opReturnScript = createOpReturnScript(output.data, output.encoding || 'utf-8')
          psbt.addOutput({
            script: opReturnScript,
            value: 0n,
          })
        }
      }

      // Add change output
      const changeAddr = paymentAddress || address
      if (changeAmount > 546 && changeAddr) {
        psbt.addOutput({
          address: changeAddr,
          value: BigInt(changeAmount),
        })
      }

      const psbtBase64 = psbt.toBase64()
      const psbtHex = psbt.toHex()

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
      const inputs = selectedUTXOObjects.map((utxo) => ({
        type: 
          utxo.hasInscriptions ? 'inscription' :
          utxo.hasRunes || utxo.hasAlkanes ? 'rune' :
          'cardinal',
        tx_hash: utxo.txHash,
        tx_output_index: utxo.txOutputIndex,
        value: utxo.btcValue,
        address: utxo.address,
        inscription_id: utxo.inscriptions?.[0]?.inscriptionId,
        rune_id: utxo.runes?.[0]?.runeId,
      }))

      const dbOutputs = outputs.map(out => ({
        address: out.type === 'standard' ? out.address : '',
        amount: out.type === 'standard' ? out.amount : 0,
        type: out.type === 'standard' ? 'standard' : 'op_return',
        script: out.type === 'op_return' ? out.data : undefined,
        data: out.type === 'op_return' ? out.data : undefined,
      }))

      await createTxBuilderRecord({
        user_address: address,
        inputs,
        outputs: dbOutputs,
        change_address: changeAmount > 546 ? changeAddr : null,
        change_amount: changeAmount > 546 ? changeAmount : null,
        fee_rate: feeRate,
        tx_version: 2,
        broadcast_method: broadcastMethod,
        psbt_hex: psbtHex,
        psbt_base64: signedResponse.signedPsbtBase64,
        status: broadcastTxId ? 'broadcasting' : 'signed',
        network: network,
      })

      toast.success(
        broadcastTxId
          ? `Transaction broadcasted! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Transaction signed. Broadcast manually.'
      )

      // Reset
      setSelectedUTXOs(new Set())
      setOutputs([])
    } catch (error: any) {
      toast.error(error.message || 'Failed to build transaction')
      console.error('TX Builder error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔧 TX Builder</h1>
        <p className="text-muted-foreground">
          Build custom transactions by selecting UTXOs and adding outputs
        </p>
      </div>

      {!connected ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to use the TX Builder
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Inputs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Select UTXOs</CardTitle>
                    <CardDescription>
                      Choose UTXOs to spend ({selectedUTXOObjects.length} selected)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select
                      value={utxoFilter}
                      onChange={(e) => setUtxoFilter(e.target.value as any)}
                      className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                    >
                      <option value="all">All Types</option>
                      <option value="cardinal">Cardinal Only</option>
                      <option value="inscription">Inscriptions</option>
                      <option value="rune">Runes</option>
                    </select>
                    <select
                      value={addressFilter}
                      onChange={(e) => setAddressFilter(e.target.value as any)}
                      className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                    >
                      <option value="all">All Addresses</option>
                      <option value="payment">Payment Address</option>
                      <option value="ordinals">Ordinals Address</option>
                    </select>
                  </div>

                  {utxosLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">Loading UTXOs...</p>
                    </div>
                  ) : filteredUTXOs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No UTXOs found matching filters
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filteredUTXOs.map((utxo) => {
                        const key = `${utxo.txHash}-${utxo.txOutputIndex}`
                        const isSelected = selectedUTXOs.has(key)
                        return (
                          <div
                            key={key}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'hover:bg-accent'
                            }`}
                            onClick={() => handleToggleUTXO(utxo)}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleUTXO(utxo)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold">{formatSats(utxo.btcValue)} sats</span>
                                  {utxo.hasInscriptions && (
                                    <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
                                      Inscription
                                    </span>
                                  )}
                                  {utxo.hasRunes && (
                                    <span className="text-xs bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded">
                                      Rune
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                  {truncateString(String(utxo.txHash), 16)}:{utxo.txOutputIndex}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {utxo.address === paymentAddress ? 'Payment' : 'Ordinals'} • {utxo.confirmations !== undefined ? `${utxo.confirmations} confs` : 'Unconfirmed'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Outputs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Outputs</CardTitle>
                    <CardDescription>
                      Add recipients and amounts ({outputs.length} added)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddOutput}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Output
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {outputs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="mb-4">No outputs added yet</p>
                    <Button onClick={handleAddOutput} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Output
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outputs.map((output, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="font-medium">Output #{index + 1}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOutput(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">Type</Label>
                            <select
                              value={output.type}
                              onChange={(e) => handleUpdateOutput(index, 'type', e.target.value)}
                              className="w-full mt-1 px-3 py-2 border rounded-md"
                            >
                              <option value="standard">Standard (Address + Amount)</option>
                              <option value="op_return">OP_RETURN (Data)</option>
                            </select>
                          </div>
                          {output.type === 'standard' ? (
                            <>
                              <div>
                                <Label className="text-sm">Address</Label>
                                <Input
                                  value={output.address}
                                  onChange={(e) => handleUpdateOutput(index, 'address', e.target.value)}
                                  placeholder="bc1q..."
                                  className="font-mono mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-sm">Amount (sats)</Label>
                                <Input
                                  type="number"
                                  value={output.amount || ''}
                                  onChange={(e) => handleUpdateOutput(index, 'amount', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="mt-1"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <Label className="text-sm">Data</Label>
                                <Input
                                  value={output.data || ''}
                                  onChange={(e) => handleUpdateOutput(index, 'data', e.target.value)}
                                  placeholder="Enter OP_RETURN data"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-sm">Encoding</Label>
                                <select
                                  value={output.encoding || 'utf-8'}
                                  onChange={(e) => handleUpdateOutput(index, 'encoding', e.target.value)}
                                  className="w-full mt-1 px-3 py-2 border rounded-md"
                                >
                                  <option value="utf-8">UTF-8</option>
                                  <option value="hex">Hex</option>
                                </select>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button onClick={handleAddOutput} variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Output
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary and Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected UTXOs:</span>
                  <span className="font-medium">{selectedUTXOObjects.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Input:</span>
                  <span className="font-medium">{formatSats(totalInput)} sats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Output:</span>
                  <span className="font-medium">{formatSats(totalOutput)} sats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee ({feeRate} sat/vB):</span>
                  <span className="font-medium text-orange-600">{formatSats(fee)} sats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Change:</span>
                  <span className={`font-medium ${changeAmount < 0 ? 'text-red-500' : changeAmount > 546 ? 'text-green-600' : ''}`}>
                    {changeAmount < 0 
                      ? `-${formatSats(Math.abs(changeAmount))} sats (insufficient)`
                      : changeAmount > 546 
                      ? `${formatSats(changeAmount)} sats → ${paymentAddress ? truncateString(paymentAddress, 20) : truncateString(address || '', 20)}`
                      : 'No change (dust)'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Transaction Size:</span>
                  <span className="font-medium">{vBytes} vBytes</span>
                </div>
                {changeAmount < 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                    ⚠️ Insufficient funds. Need {formatSats(Math.abs(changeAmount))} more sats.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>
                      {recommendedFeeRate 
                        ? `Recommended: ${recommendedFeeRate} sat/vB (auto-selected)`
                        : 'Configure transaction settings'}
                    </CardDescription>
                  </div>
                  {recommendedFeeRate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFeeRate(recommendedFeeRate)}
                    >
                      Use Recommended
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FeeSelector feeRate={feeRate} onChange={setFeeRate} />
                <BroadcastMethodSelector method={broadcastMethod} onChange={setBroadcastMethod} />
              </CardContent>
            </Card>
          </div>

          <Button
            onClick={handleBuild}
            disabled={!canBuild || loading || !connected}
            className="w-full mt-6"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building Transaction...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Build & Sign Transaction
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
