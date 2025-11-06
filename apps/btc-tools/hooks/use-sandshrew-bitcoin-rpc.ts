'use client'

import { useState, useCallback } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import {
  getBlockchainInfo,
  getBlockCount,
  getMempoolInfo,
  getMempoolEntry,
  getMempoolAncestors,
  getMempoolDescendants,
  getRawTransaction,
  createRawTransaction,
  createPSBT,
  decodePSBT,
  analyzePSBT,
  finalizePSBT,
  sendRawTransaction,
  testMempoolAccept,
  validateAddress,
  estimateSmartFee,
  isTransactionInMempool,
  getTransactionAncestors,
  getTransactionDescendants,
  type BlockchainInfo,
  type MempoolInfo,
  type MempoolEntry,
  type DecodedTransaction,
  type DecodedPSBT,
  type PSBTAnalysis,
} from '@/lib/sandshrew-bitcoin-rpc'

export function useSandshrewBitcoinRPC() {
  const { client } = useLaserEyes()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBlockchainInfo = useCallback(async () => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const info = await getBlockchainInfo(client)
      return info
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMempoolInfo = useCallback(async () => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const info = await getMempoolInfo(client)
      return info
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchMempoolEntry = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const entry = await getMempoolEntry(client, txid)
      return entry
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchTransaction = useCallback(async (txid: string, verbose: boolean = true) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const tx = await getRawTransaction(client, txid, verbose)
      return tx
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const createTransaction = useCallback(async (
    inputs: Array<{ txid: string; vout: number; sequence?: number }>,
    outputs: Record<string, number | string>,
    locktime?: number,
    replaceable?: boolean
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const hex = await createRawTransaction(client, inputs, outputs, locktime, replaceable)
      return hex
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const createPSBTTransaction = useCallback(async (
    inputs: Array<{ txid: string; vout: number }>,
    outputs: Record<string, number | string>,
    locktime?: number,
    replaceable?: boolean
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const psbt = await createPSBT(client, inputs, outputs, locktime, replaceable)
      return psbt
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const decodePSBTTransaction = useCallback(async (psbt: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const decoded = await decodePSBT(client, psbt)
      return decoded
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const analyzePSBTTransaction = useCallback(async (psbt: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const analysis = await analyzePSBT(client, psbt)
      return analysis
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const finalizePSBTTransaction = useCallback(async (psbt: string, extract: boolean = true) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const result = await finalizePSBT(client, psbt, extract)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const broadcastTransaction = useCallback(async (hex: string, maxfeerate?: number) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const txid = await sendRawTransaction(client, hex, maxfeerate)
      return txid
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const testTransaction = useCallback(async (hex: string, maxfeerate?: number | string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await testMempoolAccept(client, [hex], maxfeerate)
      return results[0]
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const checkTransactionInMempool = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const inMempool = await isTransactionInMempool(client, txid)
      return inMempool
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchTransactionAncestors = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const ancestors = await getTransactionAncestors(client, txid)
      return ancestors
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchTransactionDescendants = useCallback(async (txid: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const descendants = await getTransactionDescendants(client, txid)
      return descendants
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const validateAddressFormat = useCallback(async (address: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const result = await validateAddress(client, address)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchFeeEstimate = useCallback(async (confTarget: number, mode: 'ECONOMICAL' | 'CONSERVATIVE' = 'CONSERVATIVE') => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const estimate = await estimateSmartFee(client, confTarget, mode)
      return estimate
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  return {
    fetchBlockchainInfo,
    fetchMempoolInfo,
    fetchMempoolEntry,
    fetchTransaction,
    createTransaction,
    createPSBTTransaction,
    decodePSBTTransaction,
    analyzePSBTTransaction,
    finalizePSBTTransaction,
    broadcastTransaction,
    testTransaction,
    checkTransactionInMempool,
    fetchTransactionAncestors,
    fetchTransactionDescendants,
    validateAddressFormat,
    fetchFeeEstimate,
    loading,
    error,
  }
}

