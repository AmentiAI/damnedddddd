'use client'

import { useState, useEffect } from 'react'
import { useLaserEyes, type Inscription } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { useFormattedUTXOs } from '@/hooks/use-formatted-utxos'
import { FeeSelector } from '@/components/fee-selector'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { createInscriptionBurnMessage, createMultipleInscriptionBurnMessage, createBurnScript, calculateBurnFee } from '@/lib/burn-utils'
import { createBurn } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { Flame, Loader2, X, RefreshCw, FileText, Image } from 'lucide-react'
import { toast } from 'sonner'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371'
import { getUTXOsForUseCase } from '@/lib/utxo-selector'
import { getInscriptionContent } from '@/lib/sandshrew-ord'

export default function BurnInscriptionsPage() {
  const { address, connected, client, signPsbt, paymentAddress, getInscriptions: fetchInscriptions } = useLaserEyes()
  const { finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  const { utxos, loading: utxosLoading } = useFormattedUTXOs()
  
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [loadingInscriptions, setLoadingInscriptions] = useState(false)
  const [inscriptionImages, setInscriptionImages] = useState<Map<string, string>>(new Map())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [selectedInscriptionIds, setSelectedInscriptionIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [feeRate, setFeeRate] = useState(2)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [loading, setLoading] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState(0)

  // Fetch inscriptions when wallet is connected
  useEffect(() => {
    if (connected && address) {
      loadInscriptions()
    } else {
      setInscriptions([])
      setSelectedInscriptionIds(new Set())
    }
  }, [connected, address, fetchInscriptions])

  const loadInscriptions = async () => {
    if (!client) return
    if (typeof fetchInscriptions !== 'function') return

    setLoadingInscriptions(true)
    try {
      const data = await fetchInscriptions()
      setInscriptions(data || [])
      
      // Load images for inscriptions
      if (data && data.length > 0 && client) {
        loadInscriptionImages(data)
      }
    } catch (error: any) {
      toast.error(`Failed to load inscriptions: ${error.message}`)
      console.error('Error loading inscriptions:', error)
    } finally {
      setLoadingInscriptions(false)
    }
  }

  const loadInscriptionImages = async (inscriptionsToLoad: Inscription[]) => {
    if (!client) return

    // Filter to only image content types
    const imageInscriptions = inscriptionsToLoad.filter(ins => {
      const contentType = ins.contentType?.toLowerCase() || ''
      return contentType.startsWith('image/') || 
             contentType.includes('png') || 
             contentType.includes('jpg') || 
             contentType.includes('jpeg') || 
             contentType.includes('gif') || 
             contentType.includes('webp') ||
             contentType.includes('svg')
    })

    // Track which images we're loading to avoid duplicates
    const loadingSet = new Set<string>()
    const loadedMap = new Map<string, string>()

    // Load images in parallel (with concurrency limit)
    const batchSize = 10
    for (let i = 0; i < imageInscriptions.length; i += batchSize) {
      const batch = imageInscriptions.slice(i, i + batchSize)
      
      await Promise.allSettled(
        batch.map(async (inscription) => {
          const inscriptionId = inscription.inscriptionId
          
          // Skip if already loaded or loading
          if (loadedMap.has(inscriptionId) || loadingSet.has(inscriptionId)) {
            return
          }

          loadingSet.add(inscriptionId)
          setLoadingImages(prev => new Set(prev).add(inscriptionId))

          try {
            // Get base64 content from Sandshrew
            const base64Content = await getInscriptionContent(client, inscriptionId)
            
            if (base64Content) {
              // Determine MIME type from content type
              const contentType = inscription.contentType || 'image/png'
              
              // Convert base64 to data URL
              const dataUrl = `data:${contentType};base64,${base64Content}`
              
              loadedMap.set(inscriptionId, dataUrl)
              setInscriptionImages(prev => {
                const newMap = new Map(prev)
                newMap.set(inscriptionId, dataUrl)
                return newMap
              })
            }
          } catch (error: any) {
            console.warn(`Failed to load image for inscription ${inscriptionId}:`, error)
            // Don't show error toast for individual image failures
          } finally {
            loadingSet.delete(inscriptionId)
            setLoadingImages(prev => {
              const newSet = new Set(prev)
              newSet.delete(inscriptionId)
              return newSet
            })
          }
        })
      )
    }
  }

  // Handle inscription selection
  const handleInscriptionToggle = (inscriptionId: string) => {
    const newSelected = new Set(selectedInscriptionIds)
    if (newSelected.has(inscriptionId)) {
      newSelected.delete(inscriptionId)
    } else {
      newSelected.add(inscriptionId)
    }
    setSelectedInscriptionIds(newSelected)
  }

  // Calculate estimated fee
  useEffect(() => {
    const selectedIds = Array.from(selectedInscriptionIds)
    if (selectedIds.length > 0 && utxos) {
      const burnMessage = selectedIds.length === 1
        ? createInscriptionBurnMessage(selectedIds[0], message || undefined)
        : createMultipleInscriptionBurnMessage(selectedIds, message || undefined)
      
      const messageLength = Buffer.from(burnMessage, 'utf-8').length
      if (messageLength > 80) {
        setEstimatedFee(0)
        return
      }

      const inputCount = selectedIds.length
      const hasChange = true
      const fee = calculateBurnFee(inputCount, messageLength, hasChange, feeRate)
      setEstimatedFee(fee)
    } else {
      setEstimatedFee(0)
    }
  }, [selectedInscriptionIds, message, feeRate, utxos])

  const handleBurn = async () => {
    const selectedIds = Array.from(selectedInscriptionIds)
    
    if (selectedIds.length === 0) {
      toast.error('Please select at least one inscription to burn')
      return
    }

    if (!connected || !address || !client) {
      toast.error('Wallet not connected')
      return
    }

    setLoading(true)

    try {
      // Find inscription UTXOs from ordinals address
      const assetUtxos = await getUTXOsForUseCase(client, 'asset')
      const selectedUtxos: typeof utxos = []
      
      for (const inscriptionId of selectedIds) {
        // Find the UTXO containing this inscription
        const utxo = assetUtxos.find(u => 
          u.inscriptions?.some((ins: any) => {
            const insId = typeof ins === 'string' ? ins : ins.inscriptionId || String(ins)
            return insId === inscriptionId
          })
        )
        
        if (!utxo) {
          throw new Error(`Inscription UTXO not found for ${inscriptionId}. Make sure the inscription is in your ordinals address (${address}).`)
        }
        
        selectedUtxos.push(utxo)
      }

      // Create burn message
      const burnMessage = selectedIds.length === 1
        ? createInscriptionBurnMessage(selectedIds[0], message || undefined)
        : createMultipleInscriptionBurnMessage(selectedIds, message || undefined)

      // Check message size
      const messageLength = Buffer.from(burnMessage, 'utf-8').length
      if (messageLength > 80) {
        throw new Error('Burn message exceeds 80 bytes. Please shorten the message.')
      }

      // Create OP_RETURN script
      const opReturnScript = createBurnScript(burnMessage)

      // Get network
      const network = client.$network.get()
      const bitcoinNetwork = getBitcoinNetwork(network)

      // Calculate fee
      const hasChange = true
      const fee = calculateBurnFee(selectedUtxos.length, messageLength, hasChange, feeRate)

      // Calculate total input value
      const totalInput = selectedUtxos.reduce((sum, utxo) => sum + utxo.btcValue, 0)

      // Build PSBT
      const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

      // Add inputs (inscription UTXOs)
      for (const utxo of selectedUtxos) {
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
        const store = (client as any).$store?.get()
        const pubKey = isPaymentAddress && store?.paymentPublicKey
          ? store.paymentPublicKey
          : utxo.address === address && store?.publicKey
          ? store.publicKey
          : null

        if (pubKey && (utxo.address.startsWith('bc1p') || utxo.address.startsWith('tb1p'))) {
          inputOptions.tapInternalKey = toXOnly(Buffer.from(pubKey, 'hex'))
        }

        psbt.addInput(inputOptions)
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
          address: paymentAddress || address,
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
        burn_type: selectedIds.length === 1 ? 'inscription' : 'multiple_inscriptions',
        asset_ids: selectedIds,
        message: message || null,
        tx_id: broadcastTxId,
        status: broadcastTxId ? 'broadcasting' : 'signed',
        network: network || 'mainnet',
      })

      toast.success(
        broadcastTxId
          ? `Inscription${selectedIds.length > 1 ? 's' : ''} burned! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Transaction signed. Broadcast manually.'
      )

      // Reset form
      setSelectedInscriptionIds(new Set())
      setMessage('')
      await loadInscriptions() // Refresh inscriptions
    } catch (error: any) {
      toast.error(error.message || 'Failed to burn inscription(s)')
      console.error('Burn error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔥 Burn Inscriptions</h1>
        <p className="text-muted-foreground">
          Select inscriptions to permanently burn by spending them to OP_RETURN
        </p>
      </div>

      {!connected ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to view and burn inscriptions
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Inscriptions</CardTitle>
                  <CardDescription>
                    Select inscriptions to burn ({selectedInscriptionIds.size} selected)
                  </CardDescription>
                </div>
                <Button
                  onClick={loadInscriptions}
                  disabled={loadingInscriptions}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingInscriptions ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInscriptions ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading inscriptions...</p>
                </div>
              ) : inscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No inscriptions found in your wallet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {inscriptions.map((inscription) => {
                    const isSelected = selectedInscriptionIds.has(inscription.inscriptionId)
                    return (
                      <div
                        key={inscription.inscriptionId}
                        className={`border rounded-lg p-3 cursor-pointer transition-all hover:border-primary ${
                          isSelected ? 'border-primary bg-primary/10' : ''
                        }`}
                        onClick={() => handleInscriptionToggle(inscription.inscriptionId)}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleInscriptionToggle(inscription.inscriptionId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-muted-foreground truncate">
                              #{inscription.number || 'N/A'}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground truncate">
                              {truncateString(inscription.inscriptionId, 16)}
                            </div>
                          </div>
                        </div>
                        <div className="aspect-square bg-muted rounded overflow-hidden mb-2 relative">
                          {loadingImages.has(inscription.inscriptionId) ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : inscriptionImages.has(inscription.inscriptionId) ? (
                            <img
                              src={inscriptionImages.get(inscription.inscriptionId)}
                              alt={`Inscription #${inscription.number}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent && !parent.querySelector('.fallback-icon')) {
                                  const fallback = document.createElement('div')
                                  fallback.className = 'w-full h-full flex items-center justify-center fallback-icon'
                                  parent.appendChild(fallback)
                                }
                              }}
                            />
                          ) : inscription.preview ? (
                            <img
                              src={inscription.preview}
                              alt={`Inscription #${inscription.number}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent && !parent.querySelector('.fallback-icon')) {
                                  const fallback = document.createElement('div')
                                  fallback.className = 'w-full h-full flex items-center justify-center fallback-icon'
                                  parent.appendChild(fallback)
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {inscription.contentType || 'Unknown'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedInscriptionIds.size > 0 && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Selected Inscriptions ({selectedInscriptionIds.size})</CardTitle>
                  <CardDescription>
                    Review the inscriptions you're about to burn. This action is permanent!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Array.from(selectedInscriptionIds).map((inscriptionId) => {
                      const inscription = inscriptions.find(ins => ins.inscriptionId === inscriptionId)
                      return (
                        <div key={inscriptionId} className="border rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {(inscriptionImages.has(inscriptionId) || inscription?.preview) && (
                              <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                                {loadingImages.has(inscriptionId) ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  </div>
                                ) : inscriptionImages.has(inscriptionId) ? (
                                  <img
                                    src={inscriptionImages.get(inscriptionId)}
                                    alt={`Inscription #${inscription?.number}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : inscription?.preview ? (
                                  <img
                                    src={inscription.preview}
                                    alt={`Inscription #${inscription.number}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : null}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">
                                Inscription #{inscription?.number || 'N/A'}
                              </div>
                              <div className="text-sm font-mono text-muted-foreground truncate">
                                {truncateString(inscriptionId, 30)}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInscriptionToggle(inscriptionId)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Optional Burn Message</CardTitle>
                  <CardDescription>
                    Add an optional on-chain message to include in the burn (max 60 characters)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="Enter optional burn message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={60}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {message.length}/60 characters
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
                disabled={loading || !connected || selectedInscriptionIds.size === 0}
                className="w-full"
                size="lg"
                variant="destructive"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Burning...
                  </>
                ) : (
                  <>
                    <Flame className="h-4 w-4 mr-2" />
                    Burn {selectedInscriptionIds.size} Inscription{selectedInscriptionIds.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}



