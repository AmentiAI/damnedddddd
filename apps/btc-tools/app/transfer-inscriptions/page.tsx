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
import { createInscriptionTransfer } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { Send, Loader2, X, RefreshCw, FileText, Image } from 'lucide-react'
import { toast } from 'sonner'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import { estimateTransactionSize, calculateFee } from '@/lib/fee-calculator'
import { getUTXOsForUseCase } from '@/lib/utxo-selector'
import { getInscription, getInscriptionContent } from '@/lib/sandshrew-ord'

interface Transfer {
  inscriptionId: string
  recipientAddress: string
  inscription?: Inscription
}

export default function TransferInscriptionsPage() {
  const { address, connected, client, signPsbt, sendInscriptions, getInscriptions: fetchInscriptions, paymentAddress } = useLaserEyes()
  const { finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  const { utxos, loading: utxosLoading } = useFormattedUTXOs()
  
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [loadingInscriptions, setLoadingInscriptions] = useState(false)
  const [inscriptionImages, setInscriptionImages] = useState<Map<string, string>>(new Map())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [selectedInscriptionIds, setSelectedInscriptionIds] = useState<Set<string>>(new Set())
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [feeRate, setFeeRate] = useState(2)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')
  const [loading, setLoading] = useState(false)
  const [estimatedFee, setEstimatedFee] = useState(0)
  const [transferMode, setTransferMode] = useState<'single' | 'multiple'>('single')

  // Fetch inscriptions when wallet is connected
  useEffect(() => {
    if (connected && address) {
      loadInscriptions()
    } else {
      setInscriptions([])
      setSelectedInscriptionIds(new Set())
      setTransfers([])
    }
  }, [connected, address, fetchInscriptions])

  const loadInscriptions = async () => {
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
      // Remove from transfers
      setTransfers(transfers.filter(t => t.inscriptionId !== inscriptionId))
    } else {
      newSelected.add(inscriptionId)
      // Add to transfers with current recipient or empty
      const inscription = inscriptions.find(ins => ins.inscriptionId === inscriptionId)
      setTransfers([...transfers, {
        inscriptionId,
        recipientAddress: transferMode === 'single' && recipientInput ? recipientInput : '',
        inscription,
      }])
    }
    setSelectedInscriptionIds(newSelected)
  }

  // Update recipient for all transfers (single mode) or specific transfer (multiple mode)
  const handleRecipientChange = (value: string, index?: number) => {
    setRecipientInput(value)
    
    if (transferMode === 'single') {
      // Update all transfers with same recipient
      setTransfers(transfers.map(t => ({ ...t, recipientAddress: value })))
    } else if (index !== undefined) {
      // Update specific transfer
      const newTransfers = [...transfers]
      newTransfers[index].recipientAddress = value
      setTransfers(newTransfers)
    }
  }

  // Remove transfer
  const handleRemoveTransfer = (inscriptionId: string) => {
    setTransfers(transfers.filter(t => t.inscriptionId !== inscriptionId))
    const newSelected = new Set(selectedInscriptionIds)
    newSelected.delete(inscriptionId)
    setSelectedInscriptionIds(newSelected)
  }

  // When transfer mode changes, update recipients
  useEffect(() => {
    if (transferMode === 'single' && recipientInput) {
      // Update all transfers with the single recipient
      setTransfers(transfers.map(t => ({ ...t, recipientAddress: recipientInput })))
    }
  }, [transferMode])

  // Calculate estimated fee
  useEffect(() => {
    if (transfers.length > 0 && utxos) {
      const validTransfers = transfers.filter(t => t.recipientAddress.trim())
      if (validTransfers.length > 0) {
        const inputCount = validTransfers.length + 1 // inscriptions + payment UTXO
        const outputCount = validTransfers.length + 1 // recipients + change
        const sizeEstimate = estimateTransactionSize(inputCount, outputCount)
        const fee = calculateFee(feeRate, sizeEstimate.totalVBytes)
        setEstimatedFee(fee)
      } else {
        setEstimatedFee(0)
      }
    } else {
      setEstimatedFee(0)
    }
  }, [transfers, feeRate, utxos])

  const handleTransfer = async () => {
    const validTransfers = transfers.filter(t => t.recipientAddress.trim())
    
    if (validTransfers.length === 0) {
      toast.error('Please select at least one inscription and enter recipient address(es)')
      return
    }

    if (!connected || !address || !client) {
      toast.error('Wallet not connected')
      return
    }

    setLoading(true)

    try {
      // Group transfers by recipient for batch sending
      const transfersByRecipient = new Map<string, string[]>()
      validTransfers.forEach(transfer => {
        const existing = transfersByRecipient.get(transfer.recipientAddress) || []
        transfersByRecipient.set(transfer.recipientAddress, [...existing, transfer.inscriptionId])
      })

      // Try to use sendInscriptions for single recipient (simpler path)
      // If it fails, fall back to manual PSBT building
      let useManualPSBT = transfersByRecipient.size > 1
      
      if (transfersByRecipient.size === 1) {
        const [recipient, inscriptionIds] = Array.from(transfersByRecipient.entries())[0]
        
        try {
          const txId = await sendInscriptions(inscriptionIds, recipient)
          
          if (!txId) {
            throw new Error('Transaction ID not returned from sendInscriptions')
          }
          
          // Save to database
          await createInscriptionTransfer({
            user_address: address,
            inscription_ids: inscriptionIds,
            recipient_addresses: [recipient],
            tx_id: txId,
            status: 'broadcasting',
          })

          toast.success(`Inscriptions transferred! TXID: ${truncateString(txId, 16)}`)
          
          // Reset form and return early on success
          setSelectedInscriptionIds(new Set())
          setTransfers([])
          setRecipientInput('')
          await loadInscriptions() // Refresh inscriptions
          return
        } catch (error: any) {
          // If sendInscriptions fails, fall back to manual PSBT building
          console.warn('sendInscriptions failed, falling back to manual PSBT:', error)
          useManualPSBT = true
        }
      }
      
      // Multiple recipients OR sendInscriptions failed - build custom transaction
      if (useManualPSBT) {
        // First, verify inscriptions exist and get their locations
        const inscriptionInfos = await Promise.all(
          validTransfers.map(transfer => getInscription(client, transfer.inscriptionId))
        )
        
        // Verify inscriptions are owned by user's address
        for (let i = 0; i < validTransfers.length; i++) {
          const transfer = validTransfers[i]
          const inscriptionInfo = inscriptionInfos[i]
          
          if (inscriptionInfo.address !== address) {
            throw new Error(`Inscription ${transfer.inscriptionId} is not owned by your address. Current owner: ${inscriptionInfo.address}`)
          }
        }
        
        // Find inscription UTXOs from ordinals address
        const assetUtxos = await getUTXOsForUseCase(client, 'asset')
        const selectedUtxos: Array<{ utxo: any; recipient: string; inscriptionInfo: any }> = []
        
        for (let i = 0; i < validTransfers.length; i++) {
          const transfer = validTransfers[i]
          const inscriptionInfo = inscriptionInfos[i]
          
          // Parse satpoint to get the actual UTXO location
          // Format: txid:vout:offset
          const [txid, voutStr] = inscriptionInfo.satpoint.split(':')
          const vout = parseInt(voutStr || '0')
          
          // Find the UTXO by txid and vout (more accurate than just txid)
          let utxo = assetUtxos.find(u => 
            u.txHash === txid && 
            u.txOutputIndex === vout
          )
          
          // Fallback: if not found by exact match, try finding by inscription ID
          if (!utxo) {
            utxo = assetUtxos.find(u => 
              u.inscriptions?.some((ins: any) => {
                const insId = typeof ins === 'string' ? ins : ins.inscriptionId || String(ins)
                return insId === transfer.inscriptionId
              })
            )
          }
          
          if (!utxo) {
            throw new Error(`Inscription UTXO not found for ${transfer.inscriptionId}. Make sure the inscription is in your ordinals address (${address}).`)
          }
          
          // Verify the inscription is actually in this UTXO
          const hasInscription = utxo.inscriptions?.some((ins: any) => {
            const insId = typeof ins === 'string' ? ins : ins.inscriptionId || String(ins)
            return insId === transfer.inscriptionId
          })
          
          if (!hasInscription && !utxo.hasInscriptions) {
            throw new Error(`Inscription ${transfer.inscriptionId} not found in UTXO ${utxo.txHash}:${utxo.txOutputIndex}`)
          }
          
          selectedUtxos.push({ utxo, recipient: transfer.recipientAddress, inscriptionInfo })
        }

        // Get network
        const network = client.$network.get()
        const bitcoinNetwork = getBitcoinNetwork(network)

        // Calculate fee
        const inputCount = selectedUtxos.length + 1 // inscriptions + payment UTXO
        const outputCount = validTransfers.length + 1 // recipients + change
        const sizeEstimate = estimateTransactionSize(inputCount, outputCount)
        const fee = calculateFee(feeRate, sizeEstimate.totalVBytes)

        // Get payment UTXO for fees (from paymentAddress, >601 sats, confirmed, largest first)
        const paymentUtxos = await getUTXOsForUseCase(client, 'payment', {
          minValue: 601,
          requiredConfirmations: 1,
          sortOrder: 'largest-first',
          limit: 1,
        })
        
        if (paymentUtxos.length === 0 || paymentUtxos[0].btcValue < fee + 1000) {
          throw new Error('Insufficient confirmed payment UTXOs available (value > 601 sats)')
        }
        
        const paymentUtxo = paymentUtxos[0]

        // Build PSBT
        const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

        // Add inscription UTXO inputs
        for (const { utxo } of selectedUtxos) {
          const scriptPubKey = Buffer.from(utxo.scriptPubKey, 'hex')
          psbt.addInput({
            hash: utxo.txHash,
            index: utxo.txOutputIndex,
            witnessUtxo: {
              value: BigInt(utxo.btcValue),
              script: scriptPubKey,
            },
            tapInternalKey: utxo.tapInternalKey 
              ? Buffer.from(utxo.tapInternalKey, 'hex')
              : undefined,
          })
        }

        // Add payment UTXO for fees
        const paymentScriptPubKey = Buffer.from(paymentUtxo.scriptPubKey, 'hex')
        psbt.addInput({
          hash: paymentUtxo.txHash,
          index: paymentUtxo.txOutputIndex,
          witnessUtxo: {
            value: BigInt(paymentUtxo.btcValue),
            script: paymentScriptPubKey,
          },
          tapInternalKey: paymentUtxo.tapInternalKey 
            ? Buffer.from(paymentUtxo.tapInternalKey, 'hex')
            : undefined,
        })

        // Add outputs (one per recipient with inscription)
        // Use the actual UTXO value to preserve the inscription's sats
        for (const { utxo, recipient } of selectedUtxos) {
          // Send inscription with its original value (preserves the inscription)
          psbt.addOutput({
            address: recipient,
            value: BigInt(utxo.btcValue),
          })
        }

        // Add change output
        const totalInput = selectedUtxos.reduce((sum, { utxo }) => sum + utxo.btcValue, 0) + paymentUtxo.btcValue
        const totalOutput = selectedUtxos.reduce((sum, { utxo }) => sum + utxo.btcValue, 0) // Sum of all inscription outputs
        const change = totalInput - totalOutput - fee

        if (change > 546) {
          // Change goes back to payment address (not ordinals address)
          const changeAddress = paymentAddress || address
          psbt.addOutput({
            address: changeAddress,
            value: BigInt(change),
          })
        } else if (change < 0) {
          throw new Error('Insufficient balance for fees')
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
        await createInscriptionTransfer({
          user_address: address,
          inscription_ids: validTransfers.map(t => t.inscriptionId),
          recipient_addresses: validTransfers.map(t => t.recipientAddress),
          tx_id: broadcastTxId,
          status: broadcastTxId ? 'broadcasting' : 'signed',
        })

        toast.success(
          broadcastTxId
            ? `Inscriptions transferred! TXID: ${truncateString(broadcastTxId, 16)}`
            : 'Transaction signed. Broadcast manually.'
        )
      }

      // Reset form
      setSelectedInscriptionIds(new Set())
      setTransfers([])
      setRecipientInput('')
      await loadInscriptions() // Refresh inscriptions
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer inscriptions')
      console.error('Transfer error:', error)
    } finally {
      setLoading(false)
    }
  }

  const validTransfers = transfers.filter(t => t.recipientAddress.trim())

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📩 Transfer Inscriptions</h1>
        <p className="text-muted-foreground">
          Select your inscriptions and transfer them to one or more addresses
        </p>
      </div>

      {!connected ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to view and transfer inscriptions
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
                    Select inscriptions to transfer ({selectedInscriptionIds.size} selected)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadInscriptions}
                  disabled={loadingInscriptions}
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
                              #{inscription.number}
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
                  <CardTitle>Transfer Mode</CardTitle>
                  <CardDescription>
                    Choose how to transfer inscriptions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setTransferMode('single')}
                      className={`flex-1 p-4 border rounded-lg transition-colors ${
                        transferMode === 'single'
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="font-medium">Single Recipient</div>
                      <div className="text-sm text-muted-foreground">
                        All inscriptions to one address
                      </div>
                    </button>
                    <button
                      onClick={() => setTransferMode('multiple')}
                      className={`flex-1 p-4 border rounded-lg transition-colors ${
                        transferMode === 'multiple'
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="font-medium">Multiple Recipients</div>
                      <div className="text-sm text-muted-foreground">
                        Each inscription to different address
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Selected Inscriptions ({selectedInscriptionIds.size})</CardTitle>
                  <CardDescription>
                    {transferMode === 'single'
                      ? 'Enter recipient address for all inscriptions'
                      : 'Enter recipient address for each inscription'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {transferMode === 'single' && (
                    <div>
                      <Label htmlFor="recipient">Recipient Address (for all)</Label>
                      <Input
                        id="recipient"
                        placeholder="Enter recipient Bitcoin address"
                        value={recipientInput}
                        onChange={(e) => handleRecipientChange(e.target.value)}
                        className="font-mono mt-1"
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {transfers.map((transfer, index) => {
                      const inscription = inscriptions.find(ins => ins.inscriptionId === transfer.inscriptionId)
                      return (
                        <div key={transfer.inscriptionId} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {(inscriptionImages.has(transfer.inscriptionId) || inscription?.preview) && (
                                <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                                  {loadingImages.has(transfer.inscriptionId) ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : inscriptionImages.has(transfer.inscriptionId) ? (
                                    <img
                                      src={inscriptionImages.get(transfer.inscriptionId)}
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
                                <div className="font-medium mb-1">
                                  Inscription #{inscription?.number || 'N/A'}
                                </div>
                                <div className="text-sm font-mono text-muted-foreground truncate">
                                  {truncateString(transfer.inscriptionId, 50)}
                                </div>
                                {inscription?.contentType && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {inscription.contentType}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTransfer(transfer.inscriptionId)}
                              className="h-6 w-6 p-0 flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {transferMode === 'multiple' && (
                            <div>
                              <Label htmlFor={`recipient-${index}`} className="text-sm">
                                Recipient Address
                              </Label>
                              <Input
                                id={`recipient-${index}`}
                                placeholder="Enter recipient Bitcoin address"
                                value={transfer.recipientAddress}
                                onChange={(e) => handleRecipientChange(e.target.value, index)}
                                className="font-mono mt-1"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {validTransfers.length > 0 && (
                <>
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
                    onClick={handleTransfer}
                    disabled={loading || !connected || validTransfers.length === 0}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Transferring...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Transfer {validTransfers.length} Inscription{validTransfers.length !== 1 ? 's' : ''}
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
