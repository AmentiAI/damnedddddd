'use client'

import { useState, useCallback } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import {
  multicall,
  batchGetTransactions,
  batchGetTransactionStatuses,
  batchGetInscriptions,
  batchGetAddressInfo,
  batchGetUTXOs,
  batchCheckMempool,
  type MulticallRequest,
  type MulticallResponse,
} from '@/lib/sandshrew-multicall'

export function useSandshrewMulticall() {
  const { client } = useLaserEyes()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeMulticall = useCallback(async (requests: MulticallRequest[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await multicall(client, requests)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMultipleTransactions = useCallback(async (txids: string[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await batchGetTransactions(client, txids)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMultipleTransactionStatuses = useCallback(async (txids: string[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await batchGetTransactionStatuses(client, txids)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMultipleInscriptions = useCallback(async (inscriptionIds: string[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await batchGetInscriptions(client, inscriptionIds)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMultipleAddresses = useCallback(async (addresses: string[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await batchGetAddressInfo(client, addresses)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMultipleUTXOs = useCallback(async (utxos: Array<{ txid: string; vout: number }>) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await batchGetUTXOs(client, utxos)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const checkMultipleMempool = useCallback(async (txids: string[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await batchCheckMempool(client, txids)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  return {
    executeMulticall,
    fetchMultipleTransactions,
    fetchMultipleTransactionStatuses,
    fetchMultipleInscriptions,
    fetchMultipleAddresses,
    fetchMultipleUTXOs,
    checkMultipleMempool,
    loading,
    error,
  }
}

