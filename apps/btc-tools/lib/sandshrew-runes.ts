/**
 * Sandshrew Runes API Utilities
 * 
 * These utilities provide easy access to Sandshrew's rune endpoints
 * for querying rune balances and information.
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'

// Rune Types
export interface RuneInfo {
  id: string
  name: string
  spacedName: string
  divisibility: number
  spacers: number
  symbol: string
}

export interface RuneBalance {
  rune: RuneInfo
  balance: string
}

export interface RuneOutpoint {
  runes: RuneBalance[]
  outpoint: {
    txid: string
    vout: number
  }
  output: {
    value: string
    script: string
  }
  height: number
  txindex: number
}

export interface RuneAddressResponse {
  outpoints: RuneOutpoint[]
  balanceSheet: RuneBalance[]
}

/**
 * Get rune balances for an address
 * 
 * @param address - Bitcoin address to query
 * @param blockHeight - Optional block height (default: "latest")
 */
export async function getRunesByAddress(
  client: LaserEyesClient,
  address: string,
  blockHeight?: string | number
): Promise<RuneAddressResponse> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  try {
    const params = blockHeight !== undefined ? [address, blockHeight.toString()] : [address]
    const response = await sandshrew.call('runes_address', params)
    
    // Log the actual response for debugging
    console.log('runes_address response:', JSON.stringify(response, null, 2))
    
    // Check for JSON-RPC error response
    if (response?.error) {
      throw new Error(`Sandshrew API error: ${response.error.message || JSON.stringify(response.error)}`)
    }
    
    // Handle different response structures
    let result: RuneAddressResponse
    
    if (response?.result) {
      // Standard JSON-RPC response with result field
      result = response.result as RuneAddressResponse
    } else if (response?.outpoints || response?.balanceSheet) {
      // Response is already the data structure
      result = response as RuneAddressResponse
    } else if (Array.isArray(response)) {
      // Response might be an array (unlikely but handle it)
      throw new Error('Unexpected array response from runes_address API')
    } else {
      // Unknown response structure
      console.error('Unexpected response structure:', response)
      throw new Error(`Invalid response from Sandshrew API. Response: ${JSON.stringify(response).substring(0, 200)}`)
    }
    
    // Ensure balanceSheet exists (even if empty)
    if (!result.balanceSheet) {
      result.balanceSheet = []
    }
    if (!result.outpoints) {
      result.outpoints = []
    }
    
    return result
  } catch (error: any) {
    // Provide more context in error message
    const errorMessage = error?.message || error?.response?.data?.error?.message || 'Unknown error'
    const errorCode = error?.response?.data?.error?.code
    const statusCode = error?.response?.status
    
    console.error('getRunesByAddress error:', {
      message: errorMessage,
      code: errorCode,
      status: statusCode,
      fullError: error,
    })
    
    // Check for specific API errors
    if (errorCode === -32601 || errorMessage.includes('Method not found') || errorMessage.includes('runes_address')) {
      throw new Error(`Sandshrew API error: runes_address method not available. This endpoint may not be supported.`)
    }
    
    if (statusCode === 401 || errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
      throw new Error(`Invalid Sandshrew API key. Please check your configuration.`)
    }
    
    if (statusCode === 404) {
      throw new Error(`Sandshrew API endpoint not found.`)
    }
    
    // Preserve original error message for better debugging
    throw new Error(`Failed to fetch rune balances: ${errorMessage}`)
  }
}

/**
 * Get rune information for a specific outpoint
 * 
 * @param outpoint - Transaction outpoint in format "txid:vout"
 * @param blockHeight - Optional block height (default: "latest")
 */
export async function getRunesByOutpoint(
  client: LaserEyesClient,
  outpoint: string,
  blockHeight?: string | number
): Promise<RuneOutpoint> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = blockHeight !== undefined 
    ? [outpoint, blockHeight.toString()]
    : [outpoint, 'latest']

  const response = await sandshrew.call('runes_outpoint', params)
  return response.result as RuneOutpoint
}

/**
 * Get total rune balance for an address (summarized)
 */
export async function getRuneBalanceSheet(
  client: LaserEyesClient,
  address: string,
  blockHeight?: string | number
): Promise<RuneBalance[]> {
  const response = await getRunesByAddress(client, address, blockHeight)
  return response.balanceSheet
}

/**
 * Get all rune UTXOs for an address
 */
export async function getRuneUTXOs(
  client: LaserEyesClient,
  address: string,
  blockHeight?: string | number
): Promise<RuneOutpoint[]> {
  const response = await getRunesByAddress(client, address, blockHeight)
  return response.outpoints
}

/**
 * Get rune balance for a specific rune ID
 */
export async function getRuneBalanceById(
  client: LaserEyesClient,
  address: string,
  runeId: string,
  blockHeight?: string | number
): Promise<RuneBalance | null> {
  const balanceSheet = await getRuneBalanceSheet(client, address, blockHeight)
  return balanceSheet.find(b => b.rune.id === runeId) || null
}

/**
 * Get rune balance for a specific rune name
 */
export async function getRuneBalanceByName(
  client: LaserEyesClient,
  address: string,
  runeName: string,
  blockHeight?: string | number
): Promise<RuneBalance | null> {
  const balanceSheet = await getRuneBalanceSheet(client, address, blockHeight)
  return balanceSheet.find(b => b.rune.name === runeName || b.rune.spacedName === runeName) || null
}

/**
 * Check if address has any runes
 */
export async function hasRunes(
  client: LaserEyesClient,
  address: string,
  blockHeight?: string | number
): Promise<boolean> {
  const balanceSheet = await getRuneBalanceSheet(client, address, blockHeight)
  return balanceSheet.length > 0
}

/**
 * Get rune UTXOs filtered by rune ID
 */
export async function getRuneUTXOsById(
  client: LaserEyesClient,
  address: string,
  runeId: string,
  blockHeight?: string | number
): Promise<RuneOutpoint[]> {
  const utxos = await getRuneUTXOs(client, address, blockHeight)
  return utxos.filter(utxo => 
    utxo.runes.some(rb => rb.rune.id === runeId)
  )
}

/**
 * Format rune balance for display
 */
export function formatRuneBalance(balance: string, divisibility: number): string {
  const balanceNum = BigInt(balance)
  const divisor = BigInt(10 ** divisibility)
  const whole = balanceNum / divisor
  const remainder = balanceNum % divisor
  
  if (remainder === BigInt(0)) {
    return whole.toString()
  }
  
  const remainderStr = remainder.toString().padStart(divisibility, '0')
  return `${whole}.${remainderStr}`.replace(/\.?0+$/, '')
}

/**
 * Parse rune balance string to number (with decimals)
 */
export function parseRuneBalance(balance: string, divisibility: number): number {
  const balanceNum = BigInt(balance)
  const divisor = BigInt(10 ** divisibility)
  return Number(balanceNum) / Number(divisor)
}

