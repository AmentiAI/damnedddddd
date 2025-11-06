/**
 * Burn Utilities
 * 
 * Functions for burning inscriptions and runes by spending to OP_RETURN
 */

import * as bitcoin from 'bitcoinjs-lib'
import { createOpReturnScript } from './opreturn-utils'

/**
 * Create burn message for inscription
 * Format: "BURN:<inscription_id>[:message]"
 */
export function createInscriptionBurnMessage(
  inscriptionId: string,
  message?: string
): string {
  if (message) {
    return `BURN:${inscriptionId}:${message}`
  }
  return `BURN:${inscriptionId}`
}

/**
 * Create burn message for multiple inscriptions
 * Format: "BURN:<id1>,<id2>,<id3>[:message]"
 */
export function createMultipleInscriptionBurnMessage(
  inscriptionIds: string[],
  message?: string
): string {
  const ids = inscriptionIds.join(',')
  if (message) {
    return `BURN:${ids}:${message}`
  }
  return `BURN:${ids}`
}

/**
 * Create burn message for runes
 * Format: "BURN:RUNE:<rune_id>:<amount>[:message]"
 */
export function createRuneBurnMessage(
  runeId: string,
  amount: string,
  message?: string
): string {
  if (message) {
    return `BURN:RUNE:${runeId}:${amount}:${message}`
  }
  return `BURN:RUNE:${runeId}:${amount}`
}

/**
 * Create OP_RETURN script for burn transaction
 */
export function createBurnScript(
  burnMessage: string,
  encoding: 'utf-8' | 'hex' = 'utf-8'
): Buffer {
  return createOpReturnScript(burnMessage, encoding)
}

/**
 * Estimate burn transaction size
 */
export function estimateBurnTxSize(
  inputCount: number,
  burnMessageLength: number,
  hasChangeOutput: boolean
): number {
  // Base transaction size
  const baseSize = 10
  
  // Input size (taproot with witness)
  const inputSize = 58 + Math.ceil(97 / 4) // ~82 vBytes per input
  const totalInputSize = inputCount * inputSize
  
  // OP_RETURN output size
  const opReturnOutputSize = 8 + 1 + (1 + burnMessageLength) // value(8) + scriptLen(1) + OP_RETURN(1) + message
  
  // Change output size (if needed)
  const changeOutputSize = hasChangeOutput ? 43 : 0
  
  // Witness data
  const witnessSize = inputCount * 97
  const witnessVBytes = Math.ceil(witnessSize / 4)
  
  const totalVBytes = baseSize + totalInputSize + opReturnOutputSize + changeOutputSize + witnessVBytes
  
  return totalVBytes
}

/**
 * Calculate fee for burn transaction
 */
export function calculateBurnFee(
  inputCount: number,
  burnMessageLength: number,
  hasChangeOutput: boolean,
  feeRate: number
): number {
  const size = estimateBurnTxSize(inputCount, burnMessageLength, hasChangeOutput)
  return Math.ceil(size * feeRate)
}

