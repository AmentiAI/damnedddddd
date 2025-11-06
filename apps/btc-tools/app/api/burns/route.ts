import { NextRequest, NextResponse } from 'next/server'
import { createBurnRecord, getBurnRecord } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_address, burn_type, asset_ids, message, network } = body

    if (!user_address || !burn_type || !asset_ids || !Array.isArray(asset_ids)) {
      return NextResponse.json(
        { error: 'user_address, burn_type, and asset_ids (array) are required' },
        { status: 400 }
      )
    }

    const record = await createBurnRecord({
      user_address,
      burn_type,
      asset_ids,
      message: message || null,
      tx_id: null,
      status: 'pending',
      network: network || 'mainnet',
    })

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error creating burn record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create burn record' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const record = await getBurnRecord(id)
    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error fetching burn record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch burn record' },
      { status: 500 }
    )
  }
}

