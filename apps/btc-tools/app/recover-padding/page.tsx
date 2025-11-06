'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSandshrewOrd } from '@/hooks/use-sandshrew-ord'
import { createTransaction } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { Coins, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function RecoverPaddingPage() {
  const { address, connected, client } = useLaserEyes()
  const { findPaddingUTXOs, loading } = useSandshrewOrd()
  const [paddingUTXOs, setPaddingUTXOs] = useState<Array<{
    outpoint: string
    inscriptionId: string
    excessSats: number
    outputValue: number
  }>>([])
  const [selectedUTXOs, setSelectedUTXOs] = useState<Set<string>>(new Set())
  const [totalRecoverable, setTotalRecoverable] = useState(0)

  useEffect(() => {
    if (connected && address) {
      loadPaddingUTXOs()
    }
  }, [connected, address])

  const loadPaddingUTXOs = async () => {
    if (!address) return

    try {
      const results = await findPaddingUTXOs(address)
      setPaddingUTXOs(results)
      
      const total = results.reduce((sum, utxo) => sum + utxo.excessSats, 0)
      setTotalRecoverable(total)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load UTXOs')
    }
  }

  const toggleUTXO = (outpoint: string) => {
    const newSelected = new Set(selectedUTXOs)
    if (newSelected.has(outpoint)) {
      newSelected.delete(outpoint)
    } else {
      newSelected.add(outpoint)
    }
    setSelectedUTXOs(newSelected)
    
    const selected = paddingUTXOs.filter(utxo => newSelected.has(utxo.outpoint))
    const total = selected.reduce((sum, utxo) => sum + utxo.excessSats, 0)
    setTotalRecoverable(total)
  }

  const handleRecover = async () => {
    if (selectedUTXOs.size === 0) {
      toast.error('Please select at least one UTXO to recover')
      return
    }

    if (!connected || !address || !client) {
      toast.error('Wallet not connected')
      return
    }

    try {
      // Get selected UTXOs
      const selected = paddingUTXOs.filter(utxo => selectedUTXOs.has(utxo.outpoint))
      
      // Build recovery transaction - send excess sats back to user's address
      // This is a simplified implementation - in production you'd build a proper PSBT
      // For now, we'll save the recovery attempt to the database
      
      await createTransaction({
        user_address: address,
        tool_type: 'recover_padding',
        status: 'pending',
        tx_id: null,
        fee_rate: 2, // Default fee rate
        broadcast_method: 'mempool',
        network: 'mainnet',
        metadata: {
          selected_utxos: selected.map(utxo => ({
            outpoint: utxo.outpoint,
            inscription_id: utxo.inscriptionId,
            output_value: utxo.outputValue,
            excess_sats: utxo.excessSats,
          })),
          total_recoverable: totalRecoverable,
          utxo_count: selected.length,
        },
      })

      toast.success(`Recovery transaction saved. Total recoverable: ${formatSats(totalRecoverable)} sats`)
      
      // Note: Full PSBT building and signing would be implemented here
      // This requires building a transaction that:
      // 1. Spends the selected inscription UTXOs
      // 2. Sends the inscriptions back to the user (with 546 sats each)
      // 3. Sends the excess sats to the user's address
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to create recovery transaction')
      console.error('Recovery error:', error)
    }
  }

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">💰 Recover Padding Sats</h1>
        <p className="text-muted-foreground mb-8">
          Recover excess sats from inscription UTXOs that are larger than 5k sats
        </p>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to scan for recoverable padding sats
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">💰 Recover Padding Sats</h1>
        <p className="text-muted-foreground">
          Recover excess sats from inscription UTXOs that are larger than 5k sats
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recoverable UTXOs</CardTitle>
              <CardDescription>
                {paddingUTXOs.length > 0
                  ? `${paddingUTXOs.length} UTXOs with excess padding found`
                  : 'Scanning for UTXOs with excess padding...'}
              </CardDescription>
            </div>
            <Button onClick={loadPaddingUTXOs} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading UTXOs...</div>
          ) : paddingUTXOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No UTXOs with excess padding found
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {paddingUTXOs.map((utxo) => {
                const isSelected = selectedUTXOs.has(utxo.outpoint)
                return (
                  <div
                    key={utxo.outpoint}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-accent border-border'
                    }`}
                    onClick={() => toggleUTXO(utxo.outpoint)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleUTXO(utxo.outpoint)}
                            className="rounded"
                          />
                          <span className="font-mono text-sm">
                            {truncateString(utxo.outpoint, 50)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            Inscription: {truncateString(utxo.inscriptionId, 40)}
                          </div>
                          <div>Output Value: {formatSats(utxo.outputValue)} sats</div>
                          <div className="text-green-600 font-medium">
                            Excess Padding: {formatSats(utxo.excessSats)} sats
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {paddingUTXOs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recovery Summary</CardTitle>
            <CardDescription>
              {selectedUTXOs.size > 0
                ? `${selectedUTXOs.size} UTXO(s) selected for recovery`
                : 'Select UTXOs to recover excess padding'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Recoverable:</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatSats(totalRecoverable)} sats
                </span>
              </div>
              <Button
                onClick={handleRecover}
                disabled={selectedUTXOs.size === 0}
                className="w-full"
                size="lg"
              >
                <Coins className="h-4 w-4 mr-2" />
                Recover {selectedUTXOs.size > 0 ? formatSats(totalRecoverable) : ''} Sats
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

