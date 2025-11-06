/**
 * UTXO Selection Utilities
 * 
 * Rules:
 * - Payment wallet UTXOs (paymentAddress) must be used for all tools that require sats
 * - Only use ordinals address (address/currentAddress) UTXOs when interacting with ordinals/runes
 * - When spending from paymentAddress:
 *   - Only use UTXOs with value > 601 sats
 *   - Order by largest first
 *   - Confirm UTXO is confirmed (not in mempool)
 *   - Fallback to another UTXO if needed
 */

import type { FormattedUTXO } from '@omnisat/lasereyes-core'
import type { LaserEyesClient } from '@omnisat/lasereyes-core'

export interface UTXOSelectionOptions {
  minValue?: number // Minimum value in sats (default: 601 for payment)
  maxValue?: number // Maximum value in sats
  requiredConfirmations?: number // Minimum confirmations (default: 1 to exclude mempool)
  sortOrder?: 'largest-first' | 'smallest-first'
  limit?: number // Maximum number of UTXOs to return
}

export interface UTXOSelectionResult {
  utxos: FormattedUTXO[]
  totalValue: number
  selectedCount: number
}

/**
 * Filter and sort payment UTXOs according to spending rules
 */
export function selectPaymentUTXOs(
  utxos: FormattedUTXO[],
  options: UTXOSelectionOptions & { paymentAddress?: string } = {}
): FormattedUTXO[] {
  const {
    minValue = 601,
    maxValue = Infinity,
    requiredConfirmations = 1, // Exclude mempool (0 confirmations)
    sortOrder = 'largest-first',
    limit,
    paymentAddress,
  } = options

  // Filter UTXOs:
  // 1. Must be from payment address (if specified)
  // 2. Must be confirmed (not in mempool)
  // 3. Must have value > minValue
  // 4. Must be cardinal (no inscriptions/runes) - payment UTXOs should be cardinal
  const filtered = utxos.filter((utxo) => {
    // Check address matches payment address (if specified)
    if (paymentAddress && utxo.address !== paymentAddress) {
      return false
    }
    
    // Check confirmations (exclude mempool)
    const isConfirmed = utxo.confirmations !== undefined && utxo.confirmations >= requiredConfirmations
    
    // Check value
    const meetsValueRequirement = utxo.btcValue > minValue && utxo.btcValue <= maxValue
    
    // Check if cardinal (payment UTXOs should typically be cardinal)
    const isCardinal = !utxo.hasInscriptions && !utxo.hasRunes && !utxo.hasAlkanes
    
    return isConfirmed && meetsValueRequirement && isCardinal
  })

  // Sort by value
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'largest-first') {
      // Largest first, then by confirmations (more confirmations = better)
      if (b.btcValue !== a.btcValue) {
        return b.btcValue - a.btcValue
      }
      // If same value, prefer more confirmations
      const bConf = b.confirmations ?? 0
      const aConf = a.confirmations ?? 0
      return bConf - aConf
    } else {
      // Smallest first
      if (a.btcValue !== b.btcValue) {
        return a.btcValue - b.btcValue
      }
      // If same value, prefer more confirmations
      const bConf = b.confirmations ?? 0
      const aConf = a.confirmations ?? 0
      return bConf - aConf
    }
  })

  // Apply limit if specified
  if (limit !== undefined) {
    return sorted.slice(0, limit)
  }

  return sorted
}

/**
 * Select payment UTXOs that meet a minimum value requirement
 * Tries to find the smallest set of UTXOs that cover the required amount
 */
export function selectPaymentUTXOsForAmount(
  utxos: FormattedUTXO[],
  requiredAmount: number,
  feeEstimate: number = 0,
  options: UTXOSelectionOptions & { paymentAddress?: string } = {}
): UTXOSelectionResult {
  const totalRequired = requiredAmount + feeEstimate
  
  // Get eligible payment UTXOs
  const eligible = selectPaymentUTXOs(utxos, {
    ...options,
    minValue: options.minValue ?? 601,
    paymentAddress: options.paymentAddress,
  })

  if (eligible.length === 0) {
    return {
      utxos: [],
      totalValue: 0,
      selectedCount: 0,
    }
  }

  // Try to find the smallest set of UTXOs that cover the requirement
  // Start with largest-first approach
  const selected: FormattedUTXO[] = []
  let totalGathered = 0

  for (const utxo of eligible) {
    if (totalGathered >= totalRequired) {
      break
    }
    selected.push(utxo)
    totalGathered += utxo.btcValue
  }

  // If we don't have enough, try all eligible UTXOs
  if (totalGathered < totalRequired && eligible.length > selected.length) {
    // Reset and try with more UTXOs
    const allSelected = eligible.slice(0, Math.min(eligible.length, selected.length + 10))
    const newTotal = allSelected.reduce((sum, u) => sum + u.btcValue, 0)
    
    if (newTotal >= totalRequired) {
      return {
        utxos: allSelected,
        totalValue: newTotal,
        selectedCount: allSelected.length,
      }
    }
  }

  return {
    utxos: selected,
    totalValue: totalGathered,
    selectedCount: selected.length,
  }
}

/**
 * Select asset UTXOs (inscriptions/runes) from ordinals address
 * These should be used when interacting with ordinals or runes
 */
export function selectAssetUTXOs(
  utxos: FormattedUTXO[],
  options: {
    hasInscriptions?: boolean
    hasRunes?: boolean
    hasAlkanes?: boolean
    inscriptionIds?: string[]
    runeIds?: string[]
    requiredConfirmations?: number
  } = {}
): FormattedUTXO[] {
  const {
    hasInscriptions,
    hasRunes,
    hasAlkanes,
    inscriptionIds,
    runeIds,
    requiredConfirmations = 0, // Allow mempool for assets
  } = options

  let filtered = utxos.filter((utxo) => {
    // Check confirmations if required
    if (requiredConfirmations > 0) {
      const isConfirmed = utxo.confirmations !== undefined && utxo.confirmations >= requiredConfirmations
      if (!isConfirmed) {
        return false
      }
    }

    // Filter by asset type
    if (hasInscriptions !== undefined) {
      const hasIns = utxo.hasInscriptions || (utxo.inscriptions && utxo.inscriptions.length > 0)
      if (hasInscriptions !== hasIns) {
        return false
      }
    }

    if (hasRunes !== undefined) {
      const hasR = utxo.hasRunes || (utxo.runes && utxo.runes.length > 0)
      if (hasRunes !== hasR) {
        return false
      }
    }

    if (hasAlkanes !== undefined) {
      const hasA = utxo.hasAlkanes || (utxo.alkanes && utxo.alkanes.length > 0)
      if (hasAlkanes !== hasA) {
        return false
      }
    }

    // Filter by specific inscription IDs
    if (inscriptionIds && inscriptionIds.length > 0) {
      const utxoInscriptions = utxo.inscriptions || []
      const hasMatchingInscription = inscriptionIds.some((id) => {
        return utxoInscriptions.some((ins) => {
          const insId = typeof ins === 'string' ? ins : ins.inscriptionId || String(ins)
          return insId === id
        })
      })
      if (!hasMatchingInscription) {
        return false
      }
    }

    // Filter by specific rune IDs
    if (runeIds && runeIds.length > 0) {
      const utxoRunes = utxo.runes || []
      const hasMatchingRune = runeIds.some((id) => {
        return utxoRunes.some((rune) => {
          const runeId = typeof rune === 'string' ? rune : rune.id || rune.name || String(rune)
          return runeId === id
        })
      })
      if (!hasMatchingRune) {
        return false
      }
    }

    return true
  })

  return filtered
}

/**
 * Get UTXOs from the appropriate address based on use case
 */
export async function getUTXOsForUseCase(
  client: LaserEyesClient,
  useCase: 'payment' | 'asset',
  options: UTXOSelectionOptions = {}
): Promise<FormattedUTXO[]> {
  const store = client.$store.get()
  const paymentAddress = store.paymentAddress
  const address = store.address

  if (!paymentAddress && !address) {
    throw new Error('No payment address or ordinals address available')
  }

  if (useCase === 'payment') {
    // Use payment address for spending
    if (!paymentAddress) {
      throw new Error('Payment address not available')
    }

    const allUtxos = await client.dataSourceManager.getFormattedUTXOs([paymentAddress])
    
    // Double-check that all UTXOs are from payment address (safety check)
    const paymentUtxos = allUtxos.filter(utxo => utxo.address === paymentAddress)
    
    return selectPaymentUTXOs(paymentUtxos, {
      minValue: 601,
      requiredConfirmations: 1,
      sortOrder: 'largest-first',
      paymentAddress, // Pass for additional filtering
      ...options,
    })
  } else {
    // Use ordinals address for assets
    if (!address) {
      throw new Error('Ordinals address not available')
    }

    const allUtxos = await client.dataSourceManager.getFormattedUTXOs([address])
    
    // Double-check that all UTXOs are from ordinals address (safety check)
    const assetUtxos = allUtxos.filter(utxo => utxo.address === address)
    
    return assetUtxos // Return all asset UTXOs, filtering can be done by caller
  }
}

/**
 * Verify UTXO is confirmed (not in mempool)
 */
export function isUTXOConfirmed(utxo: FormattedUTXO, minConfirmations: number = 1): boolean {
  // If confirmations is undefined, it might be in mempool - reject it
  if (utxo.confirmations === undefined) {
    return false // Unknown status, assume not confirmed (mempool)
  }
  // If confirmations is 0, it's in mempool - reject it
  if (utxo.confirmations === 0) {
    return false
  }
  // Must have at least minConfirmations
  return utxo.confirmations >= minConfirmations
}

/**
 * Get the best payment UTXO for a given amount
 * Falls back to other UTXOs if the first choice doesn't meet requirements
 * 
 * This function ensures:
 * - UTXOs are from paymentAddress
 * - UTXOs are confirmed (not in mempool)
 * - UTXOs are > 601 sats
 * - UTXOs are cardinal (no assets)
 * - UTXOs are sorted largest first
 */
export async function getBestPaymentUTXO(
  client: LaserEyesClient,
  requiredAmount: number,
  feeEstimate: number = 0,
  options: UTXOSelectionOptions = {}
): Promise<FormattedUTXO | null> {
  const paymentUtxos = await getUTXOsForUseCase(client, 'payment', {
    minValue: 601,
    requiredConfirmations: 1,
    sortOrder: 'largest-first',
    ...options,
  })

  if (paymentUtxos.length === 0) {
    return null
  }

  const totalRequired = requiredAmount + feeEstimate

  // Try to find the smallest UTXO that still covers the requirement
  // (Since they're sorted largest-first, we'll find the best fit)
  for (const utxo of paymentUtxos) {
    // Double-check it's confirmed (should already be filtered, but safety check)
    if (utxo.btcValue >= totalRequired && isUTXOConfirmed(utxo)) {
      return utxo
    }
  }

  // If no single UTXO covers it, return the largest one anyway
  // The caller should handle gathering multiple UTXOs
  // But first verify it's confirmed
  const bestUtxo = paymentUtxos[0]
  if (bestUtxo && isUTXOConfirmed(bestUtxo)) {
    return bestUtxo
  }

  return null
}

/**
 * Validate a UTXO for payment use
 * Returns detailed validation result with reasons
 */
export interface UTXOValidationResult {
  valid: boolean
  reasons: string[]
  warnings: string[]
}

export function validatePaymentUTXO(
  utxo: FormattedUTXO,
  options: {
    paymentAddress?: string
    minValue?: number
    requiredConfirmations?: number
  } = {}
): UTXOValidationResult {
  const {
    paymentAddress,
    minValue = 601,
    requiredConfirmations = 1,
  } = options

  const reasons: string[] = []
  const warnings: string[] = []

  // Check address
  if (paymentAddress && utxo.address !== paymentAddress) {
    reasons.push(`UTXO address (${utxo.address}) does not match payment address (${paymentAddress})`)
  }

  // Check confirmations
  if (utxo.confirmations === undefined) {
    reasons.push('UTXO confirmation status is unknown (likely in mempool)')
  } else if (utxo.confirmations === 0) {
    reasons.push('UTXO is unconfirmed (in mempool)')
  } else if (utxo.confirmations < requiredConfirmations) {
    reasons.push(`UTXO has only ${utxo.confirmations} confirmations (required: ${requiredConfirmations})`)
  } else if (utxo.confirmations < 6) {
    warnings.push(`UTXO has only ${utxo.confirmations} confirmations (recommended: 6+)`)
  }

  // Check value
  if (utxo.btcValue <= minValue) {
    reasons.push(`UTXO value (${utxo.btcValue} sats) is <= minimum (${minValue} sats)`)
  } else if (utxo.btcValue <= 546) {
    reasons.push(`UTXO value (${utxo.btcValue} sats) is dust (<= 546 sats)`)
  }

  // Check if cardinal
  if (utxo.hasInscriptions) {
    reasons.push('UTXO contains inscriptions (should be cardinal for payment)')
  }
  if (utxo.hasRunes) {
    reasons.push('UTXO contains runes (should be cardinal for payment)')
  }
  if (utxo.hasAlkanes) {
    reasons.push('UTXO contains alkanes (should be cardinal for payment)')
  }

  return {
    valid: reasons.length === 0,
    reasons,
    warnings,
  }
}

/**
 * Get detailed validation report for a list of UTXOs
 */
export function validatePaymentUTXOs(
  utxos: FormattedUTXO[],
  options: {
    paymentAddress?: string
    minValue?: number
    requiredConfirmations?: number
  } = {}
): {
  valid: FormattedUTXO[]
  invalid: Array<{ utxo: FormattedUTXO; validation: UTXOValidationResult }>
  summary: {
    total: number
    validCount: number
    invalidCount: number
    totalValidValue: number
  }
} {
  const valid: FormattedUTXO[] = []
  const invalid: Array<{ utxo: FormattedUTXO; validation: UTXOValidationResult }> = []

  for (const utxo of utxos) {
    const validation = validatePaymentUTXO(utxo, options)
    if (validation.valid) {
      valid.push(utxo)
    } else {
      invalid.push({ utxo, validation })
    }
  }

  const totalValidValue = valid.reduce((sum, utxo) => sum + utxo.btcValue, 0)

  return {
    valid,
    invalid,
    summary: {
      total: utxos.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      totalValidValue,
    },
  }
}

