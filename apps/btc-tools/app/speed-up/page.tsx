'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSandshrewEsplora } from '@/hooks/use-sandshrew-esplora'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import { isRBFEligible, getRBFTransaction, calculateRBFFee } from '@/lib/rbf-utils'
import { isCPFPEligible, calculateCPFPFee } from '@/lib/cpfp-utils'
import { createTransaction } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { getRecommendedFeeRate } from '@/lib/sandshrew-esplora'
import { Zap, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp, Settings } from 'lucide-react'
import { toast } from 'sonner'

export default function SpeedUpPage() {
  const { address, connected, client, signPsbt, paymentAddress } = useLaserEyes()
  const { getTransaction } = useSandshrewEsplora()
  const { finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  
  const [txid, setTxid] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Transaction state
  const [method, setMethod] = useState<'rbf' | 'cpfp' | null>(null)
  const [eligible, setEligible] = useState<{ eligible: boolean; reason?: string } | null>(null)
  const [txData, setTxData] = useState<any>(null)
  const [selectedOutput, setSelectedOutput] = useState<number | null>(null)
  
  // Fee state
  const [feeRate, setFeeRate] = useState(2)
  const [recommendedFeeRate, setRecommendedFeeRate] = useState<number | null>(null)
  const [originalFee, setOriginalFee] = useState(0)
  const [newFee, setNewFee] = useState(0)
  const [feeIncrease, setFeeIncrease] = useState(0)
  
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')

  // Get recommended fee rate on mount
  useEffect(() => {
    if (client && connected) {
      getRecommendedFeeRate(client).then(rate => {
        setRecommendedFeeRate(rate)
        setFeeRate(rate) // Auto-set to recommended
      }).catch(() => {
        // Ignore errors, use default
      })
    }
  }, [client, connected])

  // Auto-check when txid changes (with debounce)
  useEffect(() => {
    if (!txid.trim() || !client || !address) return
    
    const timer = setTimeout(() => {
      if (txid.trim().length === 64) {
        checkTransaction()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [txid])

  const checkTransaction = async () => {
    if (!txid.trim()) {
      toast.error('Please enter a transaction ID')
      return
    }

    if (!client || !address) {
      toast.error('Wallet not connected')
      return
    }

    setChecking(true)
    setEligible(null)
    setTxData(null)
    setMethod(null)

    try {
      // Check both RBF and CPFP eligibility in parallel
      const [rbfResult, cpfpResult] = await Promise.allSettled([
        isRBFEligible(client, txid.trim()),
        isCPFPEligible(client, txid.trim(), address),
      ])

      const rbfEligible = rbfResult.status === 'fulfilled' && rbfResult.value.eligible
      const cpfpEligible = cpfpResult.status === 'fulfilled' && cpfpResult.value.eligible

      if (rbfEligible) {
        // Prefer RBF - it's simpler
        setMethod('rbf')
        const tx = await getRBFTransaction(client, txid.trim())
        if (tx) {
          setTxData(tx)
          setEligible({ eligible: true })
          setOriginalFee(tx.fee)
          const feeCalc = calculateRBFFee(tx.fee, tx.decoded.vsize, feeRate)
          setNewFee(feeCalc.recommendedFee)
          setFeeIncrease(feeCalc.recommendedFee - tx.fee)
        }
      } else if (cpfpEligible) {
        setMethod('cpfp')
        const cpfpTx = cpfpResult.status === 'fulfilled' && cpfpResult.value.transaction
        if (cpfpTx) {
          setTxData(cpfpTx)
          setEligible({ eligible: true })
          if (cpfpTx.spendableOutputs.length > 0) {
            setSelectedOutput(0)
            const output = cpfpTx.spendableOutputs[0]
            const feeCalc = calculateCPFPFee(output.value, feeRate)
            setNewFee(feeCalc.fee)
            setFeeIncrease(feeCalc.fee)
          }
        }
      } else {
        const rbfReason = rbfResult.status === 'fulfilled' ? rbfResult.value.reason : 'RBF check failed'
        const cpfpReason = cpfpResult.status === 'fulfilled' ? cpfpResult.value.reason : 'CPFP check failed'
        setEligible({ 
          eligible: false, 
          reason: `Transaction is not eligible for speed-up. ${rbfReason}. ${cpfpReason}` 
        })
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check transaction')
      setEligible({ eligible: false, reason: error.message })
    } finally {
      setChecking(false)
    }
  }

  // Update fee calculations when fee rate changes
  useEffect(() => {
    if (method === 'rbf' && txData && originalFee) {
      const feeCalc = calculateRBFFee(originalFee, txData.decoded.vsize, feeRate)
      setNewFee(feeCalc.recommendedFee)
      setFeeIncrease(feeCalc.recommendedFee - originalFee)
    } else if (method === 'cpfp' && txData && selectedOutput !== null) {
      const output = txData.spendableOutputs[selectedOutput]
      if (output) {
        const feeCalc = calculateCPFPFee(output.value, feeRate)
        setNewFee(feeCalc.fee)
        setFeeIncrease(feeCalc.fee)
      }
    }
  }, [feeRate, method, txData, originalFee, selectedOutput])

  const handleSpeedUp = async () => {
    if (!eligible?.eligible || !txData || !client || !address) {
      toast.error('Transaction not eligible or wallet not connected')
      return
    }

    setLoading(true)

    try {
      if (method === 'rbf') {
        await handleRBF()
      } else if (method === 'cpfp') {
        await handleCPFP()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to speed up transaction')
      console.error('Speed up error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRBF = async () => {
    if (!txData || !client || !address) return

    const { inputs, outputs, decoded } = txData
    const feeDifference = newFee - originalFee
    
    const network = client.$network.get()
    const bitcoinNetwork = getBitcoinNetwork(network)
    
    const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })
    
    if (decoded.version) {
      psbt.setVersion(decoded.version)
    }
    if (decoded.locktime) {
      psbt.setLocktime(decoded.locktime)
    }

    // Get original transaction from Esplora to get input details
    const esploraTx = await getTransaction(client!, txid)
    
    for (const input of inputs) {
      const esploraInput = esploraTx.vin.find((inp: any) => 
        inp.txid === input.txid && inp.vout === input.vout
      )
      
      if (!esploraInput || !esploraInput.prevout) {
        throw new Error(`Could not find input details for ${input.txid}:${input.vout}`)
      }

      const prevout = esploraInput.prevout
      const scriptPubKey = Buffer.from(prevout.scriptpubkey, 'hex')
      
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        sequence: input.sequence,
        witnessUtxo: {
          value: BigInt(prevout.value),
          script: scriptPubKey,
        },
      })
    }
    
    // Adjust outputs to account for higher fee
    let remainingFee = feeDifference
    
    for (let i = outputs.length - 1; i >= 0; i--) {
      const out = outputs[i]
      if (out.address) {
        let outputValue = out.value
        if (remainingFee > 0 && out.value > 546 + remainingFee) {
          const reduction = Math.min(remainingFee, out.value - 546)
          outputValue = out.value - reduction
          remainingFee -= reduction
        }
        
        psbt.addOutput({
          address: out.address,
          value: BigInt(outputValue),
        })
      }
    }
    
    if (remainingFee > 0) {
      throw new Error(`Insufficient output value to cover fee increase. Need ${remainingFee} more sats.`)
    }

    const psbtBase64 = psbt.toBase64()
    const signedResponse = await signPsbt(psbtBase64, false, false)
    if (!signedResponse?.signedPsbtBase64) {
      throw new Error('Failed to sign PSBT')
    }

    const finalized = await finalizePSBTTransaction(signedResponse.signedPsbtBase64, true)
    if (!finalized.hex) {
      throw new Error('Failed to finalize PSBT')
    }

    let broadcastTxId: string | null = null

    if (broadcastMethod === 'mempool' || broadcastMethod === 'mara_slipstream') {
      broadcastTxId = await broadcastTransaction(finalized.hex)
    }

    await createTransaction({
      user_address: address,
      tool_type: 'speed_up',
      status: broadcastTxId ? 'broadcasting' : 'signed',
      tx_id: broadcastTxId,
      psbt_hex: finalized.hex,
      psbt_base64: signedResponse.signedPsbtBase64,
      fee_rate: feeRate,
      broadcast_method: broadcastMethod,
      network: 'mainnet',
      metadata: {
        original_txid: txid,
        original_fee: originalFee,
        new_fee: newFee,
        fee_increase: feeIncrease,
      },
    })

    toast.success(
      broadcastTxId
        ? `Transaction sped up! TXID: ${truncateString(broadcastTxId, 16)}`
        : 'Transaction signed. Broadcast manually.'
    )

    // Reset
    setTxid('')
    setTxData(null)
    setEligible(null)
    setMethod(null)
  }

  const handleCPFP = async () => {
    if (!txData || !eligible?.eligible || !client || !address || selectedOutput === null) {
      throw new Error('Transaction not eligible for CPFP or wallet not connected')
    }

    const output = txData.spendableOutputs[selectedOutput]
    if (!output) {
      throw new Error('Selected output not found')
    }

    const network = client.$network.get()
    const bitcoinNetwork = getBitcoinNetwork(network)
    
    const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })
    
    const parentTx = await getTransaction(client!, txid)
    const parentOutput = parentTx.vout[output.vout]
    
    if (!parentOutput) {
      throw new Error(`Parent output ${output.vout} not found`)
    }

    const scriptPubKey = Buffer.from(parentOutput.scriptpubkey, 'hex')
    psbt.addInput({
      hash: txData.txid,
      index: output.vout,
      witnessUtxo: {
        value: BigInt(output.value),
        script: scriptPubKey,
      },
    })

    const outputValue = (output.value - newFee) > 546 ? (output.value - newFee) : 546
    const changeAddress = paymentAddress || address
    psbt.addOutput({
      address: changeAddress,
      value: BigInt(outputValue),
    })

    const psbtBase64 = psbt.toBase64()
    const signedResponse = await signPsbt(psbtBase64, false, false)
    if (!signedResponse?.signedPsbtBase64) {
      throw new Error('Failed to sign PSBT')
    }

    const finalized = await finalizePSBTTransaction(signedResponse.signedPsbtBase64, true)
    if (!finalized.hex) {
      throw new Error('Failed to finalize PSBT')
    }

    let broadcastTxId: string | null = null

    if (broadcastMethod === 'mempool' || broadcastMethod === 'mara_slipstream') {
      broadcastTxId = await broadcastTransaction(finalized.hex)
    }

    await createTransaction({
      user_address: address,
      tool_type: 'cancel',
      status: broadcastTxId ? 'broadcasting' : 'signed',
      tx_id: broadcastTxId,
      psbt_hex: finalized.hex,
      psbt_base64: signedResponse.signedPsbtBase64,
      fee_rate: feeRate,
      broadcast_method: broadcastMethod,
      network: 'mainnet',
      metadata: {
        parent_txid: txid,
        parent_output: output.vout,
        cpfp_fee: newFee,
        remaining_value: outputValue,
      },
    })

    toast.success(
      broadcastTxId
        ? `Child transaction created! TXID: ${truncateString(broadcastTxId, 16)}`
        : 'Child transaction signed. Broadcast manually.'
    )

    // Reset
    setTxid('')
    setTxData(null)
    setEligible(null)
    setMethod(null)
    setSelectedOutput(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">⚡ Speed Up Transaction</h1>
        <p className="text-muted-foreground">
          Paste your transaction ID and we'll automatically detect the best method to speed it up
        </p>
      </div>

      {!connected ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to speed up transactions
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Transaction ID</CardTitle>
              <CardDescription>
                Paste the transaction ID you want to speed up
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter transaction ID (64 characters)"
                  value={txid}
                  onChange={(e) => setTxid(e.target.value)}
                  className="flex-1 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && txid.trim().length === 64) {
                      checkTransaction()
                    }
                  }}
                />
                <Button 
                  onClick={checkTransaction} 
                  disabled={checking || !txid.trim() || txid.trim().length !== 64}
                >
                  {checking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Check
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {checking && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-muted-foreground">Analyzing transaction...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {eligible && !checking && (
            <>
              {eligible.eligible ? (
                <>
                  <Card className="mb-6 border-green-500/20 bg-green-500/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Transaction Eligible for {method?.toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {method === 'rbf' 
                          ? 'This transaction can be sped up using Replace By Fee (RBF)'
                          : 'This transaction can be sped up using Child Pays For Parent (CPFP)'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Original Fee</div>
                            <div className="text-2xl font-bold">{formatSats(originalFee)} sats</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">New Fee</div>
                            <div className="text-2xl font-bold text-green-600">{formatSats(newFee)} sats</div>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="text-sm text-muted-foreground">Fee Increase</div>
                          <div className="text-lg font-semibold">
                            +{formatSats(feeIncrease)} sats ({((feeIncrease / originalFee) * 100).toFixed(1)}% increase)
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

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
                      <div className="space-y-4">
                        <div>
                          <Input
                            type="number"
                            value={feeRate}
                            onChange={(e) => setFeeRate(parseInt(e.target.value) || 1)}
                            min={1}
                            className="w-full"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            Current: {feeRate} sat/vB
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="mb-6">
                    <Button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      variant="ghost"
                      className="w-full"
                    >
                      {showAdvanced ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Hide Advanced Options
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Show Advanced Options
                        </>
                      )}
                    </Button>
                  </div>

                  {showAdvanced && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="h-5 w-5" />
                          Advanced Options
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {method === 'cpfp' && txData?.spendableOutputs && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">Select Output</label>
                            <div className="space-y-2">
                              {txData.spendableOutputs.map((output: any, index: number) => (
                                <div
                                  key={index}
                                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                    selectedOutput === index
                                      ? 'border-primary bg-primary/10'
                                      : 'hover:bg-accent'
                                  }`}
                                  onClick={() => setSelectedOutput(index)}
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <div className="font-medium">Output #{output.vout}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {formatSats(output.value)} sats
                                      </div>
                                    </div>
                                    <input
                                      type="radio"
                                      checked={selectedOutput === index}
                                      onChange={() => setSelectedOutput(index)}
                                      className="cursor-pointer"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Broadcast Method</label>
                          <div className="space-y-2">
                            <button
                              onClick={() => setBroadcastMethod('mempool')}
                              className={`w-full p-3 border rounded-lg text-left transition-colors ${
                                broadcastMethod === 'mempool'
                                  ? 'border-primary bg-primary/10'
                                  : 'hover:bg-accent'
                              }`}
                            >
                              <div className="font-medium">Mempool (Standard)</div>
                              <div className="text-sm text-muted-foreground">Standard mempool broadcast</div>
                            </button>
                            <button
                              onClick={() => setBroadcastMethod('mara_slipstream')}
                              className={`w-full p-3 border rounded-lg text-left transition-colors ${
                                broadcastMethod === 'mara_slipstream'
                                  ? 'border-primary bg-primary/10'
                                  : 'hover:bg-accent'
                              }`}
                            >
                              <div className="font-medium">MARA Slipstream</div>
                              <div className="text-sm text-muted-foreground">Faster broadcast method</div>
                            </button>
                            <button
                              onClick={() => setBroadcastMethod('manual')}
                              className={`w-full p-3 border rounded-lg text-left transition-colors ${
                                broadcastMethod === 'manual'
                                  ? 'border-primary bg-primary/10'
                                  : 'hover:bg-accent'
                              }`}
                            >
                              <div className="font-medium">Manual Broadcast</div>
                              <div className="text-sm text-muted-foreground">Download signed transaction</div>
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Button
                    onClick={handleSpeedUp}
                    disabled={loading || !eligible.eligible}
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
                        <Zap className="h-4 w-4 mr-2" />
                        Speed Up Transaction
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Card className="mb-6 border-red-500/20 bg-red-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      Transaction Not Eligible
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-500">{eligible.reason}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
