'use client'

import { useState, useCallback } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import {
  getRunesByAddress,
  getRunesByOutpoint,
  getRuneBalanceSheet,
  getRuneUTXOs,
  getRuneBalanceById,
  getRuneBalanceByName,
  hasRunes,
  getRuneUTXOsById,
  formatRuneBalance,
  parseRuneBalance,
  type RuneAddressResponse,
  type RuneOutpoint,
  type RuneBalance,
} from '@/lib/sandshrew-runes'

export function useSandshrewRunes() {
  const { client } = useLaserEyes()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRunesByAddress = useCallback(async (
    address: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const response = await getRunesByAddress(client, address, blockHeight)
      return response
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRunesByOutpoint = useCallback(async (
    outpoint: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const outpointData = await getRunesByOutpoint(client, outpoint, blockHeight)
      return outpointData
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRuneBalanceSheet = useCallback(async (
    address: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const balanceSheet = await getRuneBalanceSheet(client, address, blockHeight)
      // Return empty array if null/undefined
      return balanceSheet || []
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error'
      setError(errorMessage)
      console.error('fetchRuneBalanceSheet error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRuneUTXOs = useCallback(async (
    address: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const utxos = await getRuneUTXOs(client, address, blockHeight)
      return utxos
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRuneBalanceById = useCallback(async (
    address: string,
    runeId: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const balance = await getRuneBalanceById(client, address, runeId, blockHeight)
      return balance
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRuneBalanceByName = useCallback(async (
    address: string,
    runeName: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const balance = await getRuneBalanceByName(client, address, runeName, blockHeight)
      return balance
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const checkHasRunes = useCallback(async (
    address: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const hasAny = await hasRunes(client, address, blockHeight)
      return hasAny
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchRuneUTXOsById = useCallback(async (
    address: string,
    runeId: string,
    blockHeight?: string | number
  ) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const utxos = await getRuneUTXOsById(client, address, runeId, blockHeight)
      return utxos
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  return {
    fetchRunesByAddress,
    fetchRunesByOutpoint,
    fetchRuneBalanceSheet,
    fetchRuneUTXOs,
    fetchRuneBalanceById,
    fetchRuneBalanceByName,
    checkHasRunes,
    fetchRuneUTXOsById,
    formatRuneBalance,
    parseRuneBalance,
    loading,
    error,
  }
}

