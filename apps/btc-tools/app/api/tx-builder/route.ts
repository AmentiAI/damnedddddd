import { NextRequest, NextResponse } from 'next/server'
import { createTxBuilderRecord, getTxBuilderRecord, getUserTxBuilders } from '@/lib/db/queries'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      user_address,
      inputs,
      outputs,
      change_address,
      change_amount,
      fee_rate,
      tx_version,
      broadcast_method,
      network,
    } = body

    if (!user_address || !inputs || !outputs || !fee_rate) {
      return NextResponse.json(
        { error: 'user_address, inputs, outputs, and fee_rate are required' },
        { status: 400 }
      )
    }

    const record = await createTxBuilderRecord({
      user_address,
      inputs,
      outputs,
      change_address: change_address || null,
      change_amount: change_amount || null,
      fee_rate,
      tx_version: tx_version || 2,
      broadcast_method: broadcast_method || 'mempool',
      psbt_hex: null,
      psbt_base64: null,
      tx_id: null,
      status: 'pending',
      network: network || 'mainnet',
    })

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error creating TX builder record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create TX builder record' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userAddress = searchParams.get('user_address')

    if (id) {
      const record = await getTxBuilderRecord(id)
      return NextResponse.json(record)
    }

    if (userAddress) {
      const records = await getUserTxBuilders(userAddress)
      return NextResponse.json(records)
    }

    return NextResponse.json(
      { error: 'id or user_address is required' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error fetching TX builder records:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch TX builder records' },
      { status: 500 }
    )
  }
}

