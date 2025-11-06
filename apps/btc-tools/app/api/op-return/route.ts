import { NextRequest, NextResponse } from 'next/server'
import { createOpReturnRecord, getOpReturnRecord } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_address, data, data_encoding, fee_rate, broadcast_method, network } = body

    if (!user_address || !data || !fee_rate) {
      return NextResponse.json(
        { error: 'user_address, data, and fee_rate are required' },
        { status: 400 }
      )
    }

    const record = await createOpReturnRecord({
      user_address,
      data,
      data_encoding: data_encoding || 'utf-8',
      fee_rate,
      broadcast_method: broadcast_method || 'mempool',
      tx_id: null,
      status: 'pending',
      network: network || 'mainnet',
    })

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error creating OP_RETURN record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create OP_RETURN record' },
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

    const record = await getOpReturnRecord(id)
    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error fetching OP_RETURN record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch OP_RETURN record' },
      { status: 500 }
    )
  }
}

