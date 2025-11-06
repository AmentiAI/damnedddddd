'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { useSandshrewRunes } from '@/hooks/use-sandshrew-runes'
import { useFormattedUTXOs } from '@/hooks/use-formatted-utxos'
import { FeeSelector } from '@/components/fee-selector'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { createRuneBurnMessage, createBurnScript, calculateBurnFee } from '@/lib/burn-utils'
import { formatRuneBalance, parseRuneBalance } from '@/lib/sandshrew-runes'
import { createBurn } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { Flame, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'

interface RuneToBurn {
  runeId: string
  runeName: string
  balance: string
  divisibility: number
  amount: string
}

export default function BurnRunesPage() {
  const { address, connected, client, signPsbt, paymentAddress } = useLaserEyes()
  const { finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  const { fetchRuneBalanceSheet, fetchRuneUTXOsById } = useSandshrewRunes()
  const { utxos, loading: utxosLoading } = useFormattedUTXOs()
  
  const [runesToBurn, setRunesToBurn] = useState<RuneToBurn[]>([])
  const [availableRunes, setAvailableRunes] = useState<any[]>([])
  const [loadingRunes, setLoadingRunes] = useState(false)
  const [message, setMessage] = useState('')
  const [feeRate, setFeeRate] = useState(2)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [loading, setLoading] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState(0)

  // Load rune balances - use ordinals address (address) not payment address
  // Runes are typically stored in the ordinals address
  useEffect(() => {
    if (connected && address && client) {
      loadRuneBalances()
    }
  }, [connected, address, client])

  const loadRuneBalances = async () => {
    if (!client || !address) {
      toast.error('Wallet not connected or address not available')
      return
    }

    setLoadingRunes(true)
    try {
      const balanceSheet = await fetchRuneBalanceSheet(address)
      
      // Handle empty balance sheet (no runes)
      if (!balanceSheet || balanceSheet.length === 0) {
        setAvailableRunes([])
        return
      }

      setAvailableRunes(balanceSheet.map(rb => ({
        runeId: rb.rune.id,
        runeName: rb.rune.spacedName || rb.rune.name,
        balance: rb.balance,
        divisibility: rb.rune.divisibility,
      })))
    } catch (error: any) {
      const errorMessage = error?.message || error?.response?.data?.error?.message || 'Unknown error'
      console.error('Error loading rune balances:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        code: error?.code,
      })
      
      // Provide more specific error messages
      if (errorMessage.includes('not available') || errorMessage.includes('data source')) {
        toast.error('Sandshrew API not available. Please check your API key.')
      } else if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        toast.error('Network error. Please check your connection.')
      } else if (error?.response?.status === 401 || errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
        toast.error('Invalid API key. Please check your Sandshrew API key.')
      } else if (error?.response?.status === 404 || errorMessage.includes('not found') || errorMessage.includes('endpoint')) {
        toast.error('Rune API endpoint not found. The runes_address method may not be available.')
      } else if (error?.response?.status >= 500) {
        toast.error('Sandshrew API server error. Please try again later.')
      } else {
        // Show the actual error message for debugging
        const displayMessage = errorMessage.length > 100 
          ? `${errorMessage.substring(0, 100)}...` 
          : errorMessage
        toast.error(`Failed to load rune balances: ${displayMessage}`)
      }
      
      setAvailableRunes([])
    } finally {
      setLoadingRunes(false)
    }
  }

  // Add rune to burn list
  const handleAddRune = (rune: any) => {
    if (runesToBurn.find(r => r.runeId === rune.runeId)) {
      toast.error('Rune already added')
      return
    }
    
    setRunesToBurn([...runesToBurn, {
      runeId: rune.runeId,
      runeName: rune.runeName,
      balance: rune.balance,
      divisibility: rune.divisibility,
      amount: rune.balance, // Default to full balance
    }])
  }

  // Remove rune from burn list
  const handleRemoveRune = (runeId: string) => {
    setRunesToBurn(runesToBurn.filter(r => r.runeId !== runeId))
  }

  // Update burn amount
  const handleUpdateAmount = (runeId: string, amount: string) => {
    setRunesToBurn(runesToBurn.map(r => 
      r.runeId === runeId ? { ...r, amount } : r
    ))
  }

  // Calculate estimated fee
  useEffect(() => {
    if (runesToBurn.length > 0) {
      // Build burn messages
      const burnMessages = runesToBurn.map(r => 
        createRuneBurnMessage(r.runeId, r.amount, message || undefined)
      ).join('|')
      
      const messageLength = Buffer.from(burnMessages, 'utf-8').length
      if (messageLength > 80) {
        setEstimatedFee(0)
        return
      }

      // Estimate inputs (1 per rune UTXO, but might need multiple UTXOs per rune)
      const inputCount = runesToBurn.length // Simplified - actual count depends on UTXO structure
      const hasChange = true
      const fee = calculateBurnFee(inputCount, messageLength, hasChange, feeRate)
      setEstimatedFee(fee)
    } else {
      setEstimatedFee(0)
    }
  }, [runesToBurn, message, feeRate])

  const handleBurn = async () => {
    if (runesToBurn.length === 0) {
      toast.error('Please add at least one rune to burn')
      return
    }

    if (!connected || !address || !client) {
      toast.error('Wallet not connected')
      return
    }

    setLoading(true)

    try {
      // Get rune UTXOs for each rune
      const selectedUtxos: any[] = []
      
      for (const rune of runesToBurn) {
        const utxos = await fetchRuneUTXOsById(address, rune.runeId)
        if (utxos.length === 0) {
          throw new Error(`No UTXOs found for rune ${rune.runeName}`)
        }
        selectedUtxos.push(...utxos)
      }

      // Create burn message
      const burnMessages = runesToBurn.map(r => 
        createRuneBurnMessage(r.runeId, r.amount, message || undefined)
      )
      
      // Combine messages (limit to 80 bytes total)
      const combinedMessage = burnMessages.join('|')
      const messageLength = Buffer.from(combinedMessage, 'utf-8').length
      if (messageLength > 80) {
        throw new Error('Burn message exceeds 80 bytes. Please reduce the number of runes or message length.')
      }

      // Create OP_RETURN script
      const opReturnScript = createBurnScript(combinedMessage)

      // Get network
      const network = client.$network.get()
      const bitcoinNetwork = getBitcoinNetwork(network)

      // Calculate fee
      const hasChange = true
      const fee = calculateBurnFee(selectedUtxos.length, messageLength, hasChange, feeRate)

      // Calculate total input value
      const totalInput = selectedUtxos.reduce((sum, utxo) => sum + (utxo.output?.value || 546), 0)

      // Build PSBT
      const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

      // Add inputs (rune UTXOs)
      for (const utxo of selectedUtxos) {
        const scriptPubKey = Buffer.from(utxo.output.script, 'hex')
        psbt.addInput({
          hash: utxo.outpoint.txid,
          index: utxo.outpoint.vout,
          witnessUtxo: {
            value: BigInt(utxo.output.value),
            script: scriptPubKey,
          },
        })
      }

      // Add OP_RETURN output
      psbt.addOutput({
        script: opReturnScript,
        value: 0n,
      })

      // Add change output if needed
      const change = totalInput - fee
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
      await createBurn({
        user_address: address,
        burn_type: 'runes',
        asset_ids: runesToBurn.map(r => r.runeId),
        message: message || null,
        tx_id: broadcastTxId,
        status: broadcastTxId ? 'broadcasting' : 'signed',
        network: network || 'mainnet',
      })

      toast.success(
        broadcastTxId
          ? `Rune${runesToBurn.length > 1 ? 's' : ''} burned! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Transaction signed. Broadcast manually.'
      )

      // Reset form
      setRunesToBurn([])
      setMessage('')
      await loadRuneBalances() // Refresh balances
    } catch (error: any) {
      toast.error(error.message || 'Failed to burn runes')
      console.error('Burn error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🪙 Burn Runes 🔥</h1>
        <p className="text-muted-foreground">
          Permanently destroy Runes by spending them to OP_RETURN
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Runes</CardTitle>
              <CardDescription>
                Select runes to burn from your balance
              </CardDescription>
            </div>
            <Button onClick={loadRuneBalances} variant="outline" size="sm" disabled={loadingRunes}>
              {loadingRunes ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!connected ? (
            <div className="text-center py-4 text-muted-foreground">
              Please connect your wallet to view rune balances.
            </div>
          ) : loadingRunes ? (
            <div className="text-center py-4 text-muted-foreground">Loading runes...</div>
          ) : availableRunes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No runes found in your wallet.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableRunes.map((rune) => (
                <div
                  key={rune.runeId}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex-1">
                    <div className="font-medium">{rune.runeName}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatRuneBalance(rune.balance, rune.divisibility)} {rune.runeName.split('•')[0]}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {truncateString(rune.runeId, 30)}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAddRune(rune)}
                    size="sm"
                    disabled={runesToBurn.find(r => r.runeId === rune.runeId) !== undefined}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {runesToBurn.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Runes to Burn</CardTitle>
            <CardDescription>
              Adjust amounts for each rune (default: full balance)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {runesToBurn.map((rune) => (
              <div key={rune.runeId} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-medium">{rune.runeName}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {truncateString(rune.runeId, 40)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Balance: {formatRuneBalance(rune.balance, rune.divisibility)} {rune.runeName.split('•')[0]}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRune(rune.runeId)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor={`amount-${rune.runeId}`} className="text-sm">
                    Amount to Burn
                  </Label>
                  <Input
                    id={`amount-${rune.runeId}`}
                    type="text"
                    value={rune.amount}
                    onChange={(e) => handleUpdateAmount(rune.runeId, e.target.value)}
                    placeholder="Enter amount"
                    className="mt-1"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatRuneBalance(rune.amount, rune.divisibility)} {rune.runeName.split('•')[0]}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Optional Message</CardTitle>
          <CardDescription>
            Add an optional on-chain message to include in the burn
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Enter optional burn message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={40}
          />
          <div className="text-xs text-muted-foreground mt-1">
            {message.length}/40 characters
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
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Estimated Fee</span>
              <span className="text-lg font-semibold">{formatSats(estimatedFee)} sats</span>
            </div>
          </CardContent>
        </Card>
      )}

      <BroadcastMethodSelector
        method={broadcastMethod}
        onChange={setBroadcastMethod}
      />

      <Button
        onClick={handleBurn}
        disabled={loading || !connected || runesToBurn.length === 0}
        className="w-full"
        size="lg"
        variant="destructive"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Burning Rune{runesToBurn.length > 1 ? 's' : ''}...
          </>
        ) : (
          <>
            <Flame className="h-4 w-4 mr-2" />
            Burn {runesToBurn.length > 0 ? `${runesToBurn.length} ` : ''}Rune{runesToBurn.length !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {!connected && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to burn runes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
