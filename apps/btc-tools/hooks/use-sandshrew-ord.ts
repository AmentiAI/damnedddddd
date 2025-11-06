'use client'

import { useState, useCallback } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import {
  getInscription,
  getInscriptionsBatch,
  getInscriptionsByBlock,
  getOrdOutput,
  getInscriptionChildren,
  getInscriptionsBySat,
  getSatInfo,
  findInscriptionUTXOsWithPadding,
  type InscriptionInfo,
  type OrdOutput,
  type SatInfo,
} from '@/lib/sandshrew-ord'

export function useSandshrewOrd() {
  const { client } = useLaserEyes()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInscription = useCallback(async (inscriptionIdOrNumber: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const info = await getInscription(client, inscriptionIdOrNumber)
      return info
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchInscriptionsBatch = useCallback(async (inscriptionIds: string[]) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const infos = await getInscriptionsBatch(client, inscriptionIds)
      return infos
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchOrdOutput = useCallback(async (outpoint: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const output = await getOrdOutput(client, outpoint)
      return output
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const fetchSatInfo = useCallback(async (satIdentifier: string | number) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const info = await getSatInfo(client, satIdentifier)
      return info
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  const findPaddingUTXOs = useCallback(async (address: string) => {
    if (!client) {
      throw new Error('Client not available')
    }

    setLoading(true)
    setError(null)
    try {
      const results = await findInscriptionUTXOsWithPadding(client, address)
      return results
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client])

  return {
    fetchInscription,
    fetchInscriptionsBatch,
    fetchOrdOutput,
    fetchSatInfo,
    findPaddingUTXOs,
    loading,
    error,
  }
}

