'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { TransactionRecord, TransactionStatus } from '@/lib/db/types'

export function useTransactions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTransaction = useCallback(async (data: {
    user_address: string
    tool_type: string
    fee_rate?: number
    broadcast_method?: string
    network?: string
    metadata?: Record<string, any>
  }) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create transaction')
      }

      const record = await response.json()
      toast.success('Transaction record created')
      return record as TransactionRecord
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create transaction'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getTransactions = useCallback(async (userAddress: string, toolType?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ user_address: userAddress })
      if (toolType) params.append('tool_type', toolType)
      
      const response = await fetch(`/api/transactions?${params.toString()}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch transactions')
      }

      const records = await response.json()
      return records as TransactionRecord[]
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch transactions'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTransactionStatus = useCallback(async (
    id: string,
    status: TransactionStatus,
    txId?: string
  ) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, tx_id: txId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update transaction')
      }

      const record = await response.json()
      toast.success('Transaction status updated')
      return record as TransactionRecord
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update transaction'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    createTransaction,
    getTransactions,
    updateTransactionStatus,
    loading,
    error,
  }
}

