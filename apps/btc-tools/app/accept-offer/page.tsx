'use client'

import { useState } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSandshrewBitcoinRPC } from '@/hooks/use-sandshrew-bitcoin-rpc'
import { BroadcastMethodSelector } from '@/components/broadcast-method-selector'
import { validateOfferPSBT } from '@/lib/offer-utils'
import { updateOffer, createTransaction } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { CheckCircle, Loader2, Upload, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'

export default function AcceptOfferPage() {
  const { address, connected, client, signPsbt } = useLaserEyes()
  const { analyzePSBTTransaction, finalizePSBTTransaction, broadcastTransaction } = useSandshrewBitcoinRPC()
  
  const [psbtInput, setPsbtInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [psbt, setPsbt] = useState<bitcoin.Psbt | null>(null)
  const [offerDetails, setOfferDetails] = useState<{
    inscriptionId?: string
    offerPrice?: number
    buyerAddress?: string
    sellerAddress?: string
    valid: boolean
    errors: string[]
  } | null>(null)
  const [broadcastMethod, setBroadcastMethod] = useState<'mempool' | 'mara_slipstream' | 'manual'>('mempool')

  const handleValidatePSBT = async () => {
    if (!psbtInput.trim()) {
      toast.error('Please enter a PSBT')
      return
    }

    if (!client) {
      toast.error('Wallet not connected')
      return
    }

    setValidating(true)

    try {
      // Parse PSBT
      let parsedPsbt: bitcoin.Psbt
      const network = client.$network.get()
      const bitcoinNetwork = getBitcoinNetwork(network)

      if (psbtInput.trim().match(/^[0-9a-fA-F]+$/)) {
        // Hex format
        parsedPsbt = bitcoin.Psbt.fromHex(psbtInput.trim())
      } else {
        // Base64 format
        parsedPsbt = bitcoin.Psbt.fromBase64(psbtInput.trim())
      }

      // Validate PSBT
      const validation = validateOfferPSBT(parsedPsbt)
      
      if (!validation.valid) {
        setOfferDetails({
          valid: false,
          errors: validation.errors,
        })
        toast.error('PSBT validation failed')
        return
      }

      // Analyze PSBT to extract offer details
      const analysis = await analyzePSBTTransaction(parsedPsbt.toBase64())
      
      // Try to extract offer details from PSBT
      // Output 0 should be payment to seller, Output 1 should be inscription to seller
      const outputs = parsedPsbt.txOutputs
      let offerPrice = 0
      let sellerAddress = ''
      let buyerAddress = ''

      if (outputs.length >= 2) {
        // First output is payment to seller
        try {
          const paymentOutput = outputs[0]
          offerPrice = Number(paymentOutput.value)
          
          // Get address from output script
          const paymentScript = Buffer.from(paymentOutput.script).toString('hex')
          // Try to decode address from script
          // This is a simplified approach - in production, use proper script decoding
        } catch (e) {
          console.error('Error parsing output:', e)
        }
      }

      // Check if there's a change output (usually last output)
      if (outputs.length >= 3) {
        // Last output might be change to buyer
        try {
          const changeOutput = outputs[outputs.length - 1]
          // Similar address extraction
        } catch (e) {
          console.error('Error parsing change output:', e)
        }
      }

      setPsbt(parsedPsbt)
      setOfferDetails({
        valid: true,
        errors: [],
        offerPrice,
        sellerAddress: address || '',
        buyerAddress,
      })

      toast.success('PSBT validated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate PSBT')
      setOfferDetails({
        valid: false,
        errors: [error.message || 'Invalid PSBT format'],
      })
    } finally {
      setValidating(false)
    }
  }

  const handleAcceptOffer = async () => {
    if (!psbt || !offerDetails?.valid || !connected || !address || !client) {
      toast.error('Invalid offer or wallet not connected')
      return
    }

    setLoading(true)

    try {
      // Sign PSBT (seller signs the inscription input)
      const psbtBase64 = psbt.toBase64()
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

      // Try to find and update offer in database
      // Extract inscription ID from PSBT outputs if possible
      // Note: This is a simplified approach - in production you'd parse the PSBT more thoroughly
      let inscriptionId: string | undefined = offerDetails.inscriptionId
      
      // Try to extract from PSBT if not available
      if (!inscriptionId && psbt.txOutputs.length >= 2) {
        // The second output typically contains the inscription
        // This is a heuristic - in production you'd query the blockchain for inscription info
      }

      if (inscriptionId) {
        try {
          // Get offers for this inscription using the API route
          const response = await fetch(`/api/offers?inscription_id=${inscriptionId}`)
          if (response.ok) {
            const offers = await response.json()
            // Find pending offer (most recent or highest price)
            const pendingOffers = offers.filter((o: any) => o.status === 'pending')
            if (pendingOffers.length > 0) {
              // Use the first pending offer (could be sorted by price)
              const offerToUpdate = pendingOffers[0]
              await updateOffer(offerToUpdate.id, {
                status: broadcastTxId ? 'completed' : 'accepted',
                accepted_by: address,
                tx_id: broadcastTxId,
              })
            }
          }
        } catch (error) {
          console.error('Failed to update offer in database:', error)
          // Continue even if update fails
        }
      }

      // Also save to transactions table
      await createTransaction({
        user_address: address,
        tool_type: 'accept_offer',
        status: broadcastTxId ? 'broadcasting' : 'signed',
        tx_id: broadcastTxId,
        psbt_hex: finalized.hex,
        psbt_base64: signedResponse.signedPsbtBase64,
        fee_rate: 2, // Default, could be extracted from PSBT
        broadcast_method: broadcastMethod,
        network: 'mainnet',
        metadata: {
          offer_price: offerDetails.offerPrice,
          inscription_id: offerDetails.inscriptionId,
          buyer_address: offerDetails.buyerAddress,
        },
      })

      toast.success(
        broadcastTxId
          ? `Offer accepted! TXID: ${truncateString(broadcastTxId, 16)}`
          : 'Offer signed. Broadcast manually.'
      )

      // Reset form
      setPsbtInput('')
      setPsbt(null)
      setOfferDetails(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept offer')
      console.error('Accept offer error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">✅ Accept Offer</h1>
        <p className="text-muted-foreground">
          Accept and execute PSBT to sell an Inscription. Compatible with ord node.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Import Offer PSBT</CardTitle>
          <CardDescription>
            Paste the PSBT (base64 or hex) from the buyer to review and accept the offer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="psbt">PSBT</Label>
            <textarea
              id="psbt"
              placeholder="Paste PSBT here (base64 or hex format)"
              value={psbtInput}
              onChange={(e) => setPsbtInput(e.target.value)}
              className="w-full p-3 border rounded-lg font-mono text-sm mt-1"
              rows={6}
            />
          </div>
          <Button
            onClick={handleValidatePSBT}
            disabled={validating || !psbtInput.trim()}
            className="w-full"
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Validate PSBT
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {offerDetails && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {offerDetails.valid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Offer Valid
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Validation Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offerDetails.valid ? (
              <div className="space-y-4">
                {offerDetails.offerPrice && (
                  <div>
                    <div className="text-sm text-muted-foreground">Offer Price</div>
                    <div className="text-xl font-bold">{formatSats(offerDetails.offerPrice)} sats</div>
                  </div>
                )}
                {offerDetails.inscriptionId && (
                  <div>
                    <div className="text-sm text-muted-foreground">Inscription ID</div>
                    <div className="font-mono text-sm">{truncateString(offerDetails.inscriptionId, 50)}</div>
                  </div>
                )}
                {offerDetails.buyerAddress && (
                  <div>
                    <div className="text-sm text-muted-foreground">Buyer Address</div>
                    <div className="font-mono text-sm">{truncateString(offerDetails.buyerAddress, 30)}</div>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">
                    By accepting this offer, you will:
                  </div>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Transfer the inscription to the buyer</li>
                    <li>Receive {offerDetails.offerPrice ? formatSats(offerDetails.offerPrice) : 'the offer amount'} sats</li>
                    <li>Sign and broadcast the transaction</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-red-500 font-medium">Validation Errors:</div>
                <ul className="list-disc list-inside space-y-1">
                  {offerDetails.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-500">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {offerDetails?.valid && (
        <>
          <BroadcastMethodSelector
            method={broadcastMethod}
            onChange={setBroadcastMethod}
          />

          <Button
            onClick={handleAcceptOffer}
            disabled={loading || !connected}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Accepting Offer...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Offer
              </>
            )}
          </Button>
        </>
      )}

      {!connected && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to accept offers
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
