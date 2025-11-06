'use client'

import { useState, useCallback, useEffect } from 'react'
import { useLaserEyes } from '@omnisat/lasereyes'
import type { FormattedUTXO } from '@omnisat/lasereyes-core'

export function useFormattedUTXOs() {
  const { address, paymentAddress, network, client } = useLaserEyes()
  const [utxos, setUtxos] = useState<FormattedUTXO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUTXOs = useCallback(async () => {
    if (!address || !client) {
      setUtxos([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get formatted UTXOs from data source manager
      const formatted = await client.dataSourceManager.getFormattedUTXOs([
        address,
        paymentAddress || address,
      ])
      setUtxos(formatted)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch UTXOs')
      console.error('Error fetching formatted UTXOs:', err)
    } finally {
      setLoading(false)
    }
  }, [address, paymentAddress, client])

  useEffect(() => {
    if (address && client) {
      fetchUTXOs()
    }
  }, [address, client, fetchUTXOs])

  // Categorize UTXOs
  const cardinalUTXOs = utxos.filter(
    (utxo) => !utxo.hasInscriptions && !utxo.hasRunes && !utxo.hasAlkanes
  )

  const inscriptionUTXOs = utxos.filter((utxo) => utxo.hasInscriptions)

  const runeUTXOs = utxos.filter((utxo) => utxo.hasRunes || utxo.hasAlkanes)

  return {
    utxos,
    cardinalUTXOs,
    inscriptionUTXOs,
    runeUTXOs,
    loading,
    error,
    refetch: fetchUTXOs,
  }
}

