import { NextRequest, NextResponse } from 'next/server'
import { createTransactionRecord, getUserTransactions, updateTransactionStatus } from '@/lib/db/queries'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_address, tool_type, fee_rate, broadcast_method, network, metadata } = body

    if (!user_address || !tool_type) {
      return NextResponse.json(
        { error: 'user_address and tool_type are required' },
        { status: 400 }
      )
    }

    const record = await createTransactionRecord({
      user_address,
      tx_id: null,
      psbt_hex: null,
      psbt_base64: null,
      tool_type,
      status: 'pending',
      fee_rate: fee_rate || null,
      broadcast_method: broadcast_method || 'mempool',
      network: network || 'mainnet',
      metadata: metadata || null,
    })

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error creating transaction record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create transaction record' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userAddress = searchParams.get('user_address')
    const toolType = searchParams.get('tool_type')

    if (!userAddress) {
      return NextResponse.json(
        { error: 'user_address is required' },
        { status: 400 }
      )
    }

    const records = await getUserTransactions(userAddress, toolType || undefined)
    return NextResponse.json(records)
  } catch (error: any) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, tx_id } = body

    if (!id || !status) {
      return NextResponse.json(
        { error: 'id and status are required' },
        { status: 400 }
      )
    }

    const record = await updateTransactionStatus(id, status, tx_id)
    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update transaction' },
      { status: 500 }
    )
  }
}

