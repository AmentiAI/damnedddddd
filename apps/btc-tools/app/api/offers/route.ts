import { NextRequest, NextResponse } from 'next/server'
import { createOffer, getOffer, getOffersByInscription, acceptOffer } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { creator_address, inscription_id, offer_price, psbt_hex, psbt_base64 } = body

    if (!creator_address || !inscription_id || !offer_price || !psbt_hex || !psbt_base64) {
      return NextResponse.json(
        { error: 'All fields are required: creator_address, inscription_id, offer_price, psbt_hex, psbt_base64' },
        { status: 400 }
      )
    }

    const offer = await createOffer({
      creator_address,
      inscription_id,
      offer_price,
      psbt_hex,
      psbt_base64,
      status: 'pending',
      accepted_by: null,
      tx_id: null,
    })

    return NextResponse.json(offer)
  } catch (error: any) {
    console.error('Error creating offer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create offer' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const inscriptionId = searchParams.get('inscription_id')

    if (id) {
      const offer = await getOffer(id)
      return NextResponse.json(offer)
    }

    if (inscriptionId) {
      const offers = await getOffersByInscription(inscriptionId)
      return NextResponse.json(offers)
    }

    return NextResponse.json(
      { error: 'id or inscription_id is required' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error fetching offers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, accepted_by, tx_id } = body

    if (!id || !accepted_by || !tx_id) {
      return NextResponse.json(
        { error: 'id, accepted_by, and tx_id are required' },
        { status: 400 }
      )
    }

    const offer = await acceptOffer(id, accepted_by, tx_id)
    return NextResponse.json(offer)
  } catch (error: any) {
    console.error('Error accepting offer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept offer' },
      { status: 500 }
    )
  }
}

