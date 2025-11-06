/**
 * Fee calculation utilities for Bitcoin transactions
 */

export interface FeeEstimate {
  slow: number
  medium: number
  fast: number
  minimum: number
}

export interface TransactionSizeEstimate {
  baseSize: number
  inputSize: number
  outputSize: number
  witnessSize: number
  totalSize: number
  totalVBytes: number
}

/**
 * Estimate transaction size in vBytes
 */
export function estimateTransactionSize(
  inputCount: number,
  outputCount: number,
  hasWitness: boolean = true
): TransactionSizeEstimate {
  // Base transaction overhead (without witness)
  const baseSize = 10 // Version (4) + Locktime (4) + Input count (varint, ~1) + Output count (varint, ~1)

  // Input size (P2TR taproot with witness)
  // - Previous output hash (32) + Index (4) + Script length (1) + Sequence (4) = 41 bytes
  // - Witness data: ~64 bytes (signature) + 33 bytes (public key) = ~97 bytes
  // - Witness is counted as 1/4 weight, so ~24.25 vBytes
  // Total per input: ~65.25 vBytes
  const inputSize = hasWitness ? 58 + Math.ceil(97 / 4) : 148 // 148 for legacy
  const totalInputSize = inputCount * inputSize

  // Output size: ~43 bytes (P2TR)
  // - Value (8) + Script length (1) + Script (34 for P2TR) = 43 bytes
  const outputSize = 43
  const totalOutputSize = outputCount * outputSize

  const totalSize = baseSize + totalInputSize + totalOutputSize
  
  // Witness data is counted at 1/4 weight
  const witnessSize = hasWitness ? inputCount * 97 : 0
  const totalVBytes = baseSize + (totalInputSize - witnessSize) + totalOutputSize + Math.ceil(witnessSize / 4)

  return {
    baseSize,
    inputSize,
    outputSize,
    witnessSize,
    totalSize,
    totalVBytes,
  }
}

/**
 * Calculate fee based on fee rate (sat/vB) and transaction size
 */
export function calculateFee(feeRate: number, sizeVBytes: number): number {
  return Math.ceil(feeRate * sizeVBytes)
}

/**
 * Get recommended fees from mempool (placeholder - should be fetched from API)
 */
export async function getRecommendedFees(network: string = 'mainnet'): Promise<FeeEstimate> {
  try {
    const baseUrl = network === 'mainnet' 
      ? 'https://mempool.space/api/v1/fees/recommended'
      : `https://mempool.space/${network}/api/v1/fees/recommended`
    
    const response = await fetch(baseUrl)
    const data = await response.json()

    return {
      slow: data.economyFee || 1,
      medium: data.hourFee || 2,
      fast: data.fastestFee || 5,
      minimum: 1,
    }
  } catch (error) {
    console.error('Error fetching fees:', error)
    // Fallback fees
    return {
      slow: 1,
      medium: 2,
      fast: 5,
      minimum: 1,
    }
  }
}

/**
 * Calculate total transaction cost
 */
export function calculateTransactionCost(
  outputAmounts: number[],
  feeRate: number,
  inputCount: number,
  outputCount: number,
  changeOutput?: number
): {
  totalInput: number
  totalOutput: number
  fee: number
  change: number
  totalCost: number
} {
  const totalOutput = outputAmounts.reduce((sum, amount) => sum + amount, 0) + (changeOutput || 0)
  const finalOutputCount = outputCount + (changeOutput ? 1 : 0)
  
  const sizeEstimate = estimateTransactionSize(inputCount, finalOutputCount)
  const fee = calculateFee(feeRate, sizeEstimate.totalVBytes)

  // We don't know total input without UTXO data, so we'll need to calculate it elsewhere
  // This is just for fee estimation
  return {
    totalInput: 0, // Will be calculated from selected UTXOs
    totalOutput,
    fee,
    change: changeOutput || 0,
    totalCost: totalOutput + fee,
  }
}

