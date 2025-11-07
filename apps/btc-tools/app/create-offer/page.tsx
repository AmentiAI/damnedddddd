'use client'

import { useState } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FeeSelector } from '@/components/fee-selector'
import { createOfferPSBT } from '@/lib/offer-utils'
import { createOffer } from '@/lib/db/queries'
import { formatSats, truncateString } from '@/lib/utils'
import { Handshake, Download, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export default function CreateOfferPage() {
  const { address, connected, client, network: activeNetwork } = useLaserEyes()
  
  const [inscriptionId, setInscriptionId] = useState('')
  const [sellerAddress, setSellerAddress] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [feeRate, setFeeRate] = useState(2)
  const [loading, setLoading] = useState(false)
  const [offerPSBT, setOfferPSBT] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateOffer = async () => {
    if (!inscriptionId.trim()) {
      toast.error('Please enter an inscription ID')
      return
    }

    if (!sellerAddress.trim()) {
      toast.error('Please enter seller address')
      return
    }

    if (!offerPrice || parseFloat(offerPrice) <= 0) {
      toast.error('Please enter a valid offer price')
      return
    }

    if (!connected || !address || !client) {
      toast.error('Wallet not connected')
      return
    }

    const store = client.$store.get()
    const paymentAddress = store.paymentAddress || address
    const paymentPublicKey = store.paymentPublicKey || store.publicKey
    
    if (!paymentAddress || !paymentPublicKey) {
      toast.error('Payment address or public key not available')
      return
    }

    setLoading(true)

    try {
      const price = Math.floor(parseFloat(offerPrice))
      const { psbtBase64, psbtHex, offerDetails } = await createOfferPSBT(
        client,
        inscriptionId.trim(),
        price,
        sellerAddress.trim(),
        address,
        paymentAddress,
        paymentPublicKey,
        feeRate,
        activeNetwork
      )

      setOfferPSBT(psbtBase64)

      // Save to database
      await createOffer({
        creator_address: address,
        inscription_id: inscriptionId.trim(),
        offer_price: price,
        psbt_hex: psbtHex,
        psbt_base64: psbtBase64,
        status: 'pending',
        accepted_by: null,
        tx_id: null,
      })

      toast.success('Offer PSBT created successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create offer')
      console.error('Offer creation error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPSBT = () => {
    if (offerPSBT) {
      navigator.clipboard.writeText(offerPSBT)
      setCopied(true)
      toast.success('PSBT copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadPSBT = () => {
    if (offerPSBT) {
      const blob = new Blob([offerPSBT], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `offer-${inscriptionId.substring(0, 16)}.psbt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PSBT downloaded')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🤝 Create Offer</h1>
        <p className="text-muted-foreground">
          Create offer PSBT to buy an Inscription. Compatible with ord node.
        </p>
      </div>

      {!offerPSBT ? (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
              <CardDescription>
                Enter the inscription you want to buy and your offer price
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="inscription">Inscription ID</Label>
                <Input
                  id="inscription"
                  placeholder="Enter inscription ID (e.g., abc123...i0)"
                  value={inscriptionId}
                  onChange={(e) => setInscriptionId(e.target.value)}
                  className="font-mono mt-1"
                />
              </div>

              <div>
                <Label htmlFor="seller">Seller Address</Label>
                <Input
                  id="seller"
                  placeholder="Enter seller's Bitcoin address"
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.target.value)}
                  className="font-mono mt-1"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  The address that currently owns the inscription
                </div>
              </div>

              <div>
                <Label htmlFor="price">Offer Price (sats)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="Enter offer price in satoshis"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="mt-1"
                  min="546"
                />
                {offerPrice && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatSats(parseInt(offerPrice) || 0)} sats
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <FeeSelector feeRate={feeRate} onChange={setFeeRate} />

          <Button
            onClick={handleCreateOffer}
            disabled={loading || !connected || !inscriptionId.trim() || !sellerAddress.trim() || !offerPrice}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Offer...
              </>
            ) : (
              <>
                <Handshake className="h-4 w-4 mr-2" />
                Create Offer PSBT
              </>
            )}
          </Button>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Offer PSBT Created</CardTitle>
            <CardDescription>
              Share this PSBT with the seller to accept the offer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>PSBT (Base64)</Label>
              <div className="relative mt-1">
                <textarea
                  readOnly
                  value={offerPSBT}
                  className="w-full p-3 border rounded-lg font-mono text-sm bg-muted"
                  rows={6}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPSBT}
                  className="absolute top-2 right-2"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopyPSBT} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy PSBT
              </Button>
              <Button onClick={handleDownloadPSBT} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download PSBT
              </Button>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm space-y-2">
                <div>
                  <span className="font-medium">Inscription ID:</span>{' '}
                  <span className="font-mono text-xs">{truncateString(inscriptionId, 40)}</span>
                </div>
                <div>
                  <span className="font-medium">Offer Price:</span>{' '}
                  {formatSats(parseInt(offerPrice) || 0)} sats
                </div>
                <div>
                  <span className="font-medium">Seller Address:</span>{' '}
                  <span className="font-mono text-xs">{truncateString(sellerAddress, 30)}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setOfferPSBT(null)
                setInscriptionId('')
                setSellerAddress('')
                setOfferPrice('')
              }}
              variant="outline"
              className="w-full"
            >
              Create Another Offer
            </Button>
          </CardContent>
        </Card>
      )}

      {!connected && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to create offers
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

