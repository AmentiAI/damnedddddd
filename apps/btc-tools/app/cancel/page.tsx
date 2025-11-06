'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { FeeSelector } from '@/components/fee-selector'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { isCPFPEligible, calculateCPFPFee } from '@/lib/cpfp-utils'
import { createTransaction } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CancelPage() {
  const { address, connected, client, signPsbt } = useLaserEyes()
  const { createPSBTTransaction, finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  
  const [txid, setTxid] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cpfpTx, setCpfpTx] = useState<any>(null)
  const [eligible, setEligible] = useState<{ eligible: boolean; reason?: string } | null>(null)
  const [selectedOutput, setSelectedOutput] = useState<number | null>(null)
  const [feeRate, setFeeRate] = useState(50) // Higher default for CPFP
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [cpfpFee, setCpfpFee] = useState(0)
  const [remainingValue, setRemainingValue] = useState(0)

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
    setCpfpTx(null)
    setSelectedOutput(null)

    try {
      // Check if transaction is eligible for CPFP
      const eligibility = await isCPFPEligible(client, txid.trim(), address)
      setEligible(eligibility)

      if (eligibility.eligible && eligibility.transaction) {
        setCpfpTx(eligibility.transaction)
        
        // Select first available output by default
        if (eligibility.transaction.spendableOutputs.length > 0) {
          setSelectedOutput(0)
          const output = eligibility.transaction.spendableOutputs[0]
          const feeCalc = calculateCPFPFee(output.value, feeRate)
          setCpfpFee(feeCalc.fee)
          setRemainingValue(feeCalc.remainingValue)
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check transaction')
      setEligible({ eligible: false, reason: error.message })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (cpfpTx && selectedOutput !== null && feeRate) {
      const output = cpfpTx.spendableOutputs[selectedOutput]
      if (output) {
        const feeCalc = calculateCPFPFee(output.value, feeRate)
        setCpfpFee(feeCalc.fee)
        setRemainingValue(feeCalc.remainingValue)
      }
    }
  }, [feeRate, selectedOutput, cpfpTx])

  const handleCancel = async () => {
    if (!cpfpTx || !eligible?.eligible || !client || !address || selectedOutput === null) {
      toast.error('Transaction not eligible for CPFP or wallet not connected')
      return
    }

    setLoading(true)

    try {
      const output = cpfpTx.spendableOutputs[selectedOutput]
      if (!output) {
        throw new Error('Selected output not found')
      }

      // Build child transaction
      // Input: output from parent transaction
      // Output: back to user's address (or change address) minus fee
      const inputs = [{
        txid: cpfpTx.txid,
        vout: output.vout,
      }]

      const outputs: Record<string, number> = {}
      
      // Send remaining value back to user's address
      if (remainingValue > 546) {
        outputs[address] = remainingValue
      } else {
        // If remaining value is too small, send dust to user
        outputs[address] = 546
      }

      // Create PSBT for child transaction
      const psbtBase64 = await createPSBTTransaction(
        inputs,
        outputs,
        0, // locktime
        false // not replaceable
      )

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
          cpfp_fee: cpfpFee,
          remaining_value: remainingValue,
        },
      })

      toast.success(
        broadcastTxId
          ? `Child transaction created! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Child transaction signed. Broadcast manually.'
      )

      // Reset form
      setTxid('')
      setCpfpTx(null)
      setEligible(null)
      setSelectedOutput(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create CPFP transaction')
      console.error('CPFP error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">❌ Cancel Transaction</h1>
        <p className="text-muted-foreground">
          Cancel a pending transaction using CPFP (Child Pays For Parent)
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>
            Enter the transaction ID of the pending transaction you want to cancel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter transaction ID (txid)"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              className="flex-1 font-mono"
            />
            <Button onClick={checkTransaction} disabled={checking || !txid.trim()}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {eligible && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {eligible.eligible ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Transaction Eligible
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Not Eligible
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eligible.eligible ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Spendable Outputs</div>
                  <div className="space-y-2">
                    {cpfpTx?.spendableOutputs.map((output: any, index: number) => (
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
              </div>
            ) : (
              <div className="text-red-500">{eligible.reason}</div>
            )}
          </CardContent>
        </Card>
      )}

      {eligible?.eligible && cpfpTx && selectedOutput !== null && (
        <>
          <FeeSelector feeRate={feeRate} onChange={setFeeRate} />
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>CPFP Transaction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Output Value</div>
                    <div className="text-xl font-bold">
                      {formatSats(cpfpTx.spendableOutputs[selectedOutput].value)} sats
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">CPFP Fee</div>
                    <div className="text-xl font-bold text-orange-600">
                      {formatSats(cpfpFee)} sats
                    </div>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <div className="text-sm text-muted-foreground">Remaining Value</div>
                    <div className="text-lg font-semibold">
                      {formatSats(remainingValue)} sats
                      {remainingValue < 546 && (
                        <span className="text-red-500 ml-2">(Dust output)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <BroadcastMethodSelector
            method={broadcastMethod}
            onChange={setBroadcastMethod}
          />

          <Button
            onClick={handleCancel}
            disabled={loading || !connected || remainingValue < 0}
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
                <X className="h-4 w-4 mr-2" />
                Create CPFP Transaction
              </>
            )}
          </Button>
        </>
      )}

      {!connected && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to cancel transactions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
