'use client'

import { useState, useCallback } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import {
  getTransaction,
  getTransactionStatus,
  getTransactionHex,
  getTransactionOutspends,
  getAddressInfo,
  getAddressTransactions,
  getAddressUTXOs,
  getBlockInfo,
  getBlockTipHeight,
  getMempoolStats,
  getFeeEstimates,
  getRecommendedFeeRate,
  isTransactionConfirmed,
  type Transaction,
  type TransactionStatus,
  type AddressInfo,
  type BlockInfo,
  type MempoolStats,
  type FeeEstimates,
} from '@/lib/sandshrew-esplora'

export function useSandshrewEsplora() {
  const { client } = useLaserEyes()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTransaction = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const tx = await getTransaction(client, txid)
      return tx
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchTransactionStatus = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const status = await getTransactionStatus(client, txid)
      return status
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchTransactionOutspends = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const outspends = await getTransactionOutspends(client, txid)
      return outspends
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchAddressInfo = useCallback(async (address: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const info = await getAddressInfo(client, address)
      return info
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchAddressTransactions = useCallback(async (address: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const txs = await getAddressTransactions(client, address)
      return txs
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchAddressUTXOs = useCallback(async (address: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const utxos = await getAddressUTXOs(client, address)
      return utxos
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchFeeEstimates = useCallback(async () => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const estimates = await getFeeEstimates(client)
      return estimates
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRecommendedFeeRate = useCallback(async () => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const rate = await getRecommendedFeeRate(client)
      return rate
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const checkTransactionConfirmed = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const confirmed = await isTransactionConfirmed(client, txid)
      return confirmed
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const getTransactionDirect = useCallback(async (clientParam: typeof client, txid: string) => {
    if (!clientParam) {
      throw new Error('Client not available')
    }
    return await getTransaction(clientParam, txid)
  }, [])

  return {
    fetchTransaction,
    fetchTransactionStatus,
    fetchTransactionOutspends,
    fetchAddressInfo,
    fetchAddressTransactions,
    fetchAddressUTXOs,
    fetchFeeEstimates,
    fetchRecommendedFeeRate,
    checkTransactionConfirmed,
    getTransaction: getTransactionDirect,
    loading,
    error,
  }
}

