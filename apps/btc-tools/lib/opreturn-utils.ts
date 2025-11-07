/**
 * OP_RETURN Utilities
 * 
 * Functions for building OP_RETURN outputs in Bitcoin transactions
 */

import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import type { NetworkType } from '@omnisat/lasereyes-core'

/**
 * Encode data for OP_RETURN output
 */
export function encodeOpReturnData(data: string, encoding: 'utf-8' | 'hex' = 'utf-8'): Buffer {
  if (encoding === 'hex') {
    // Remove any whitespace and validate hex
    const cleanHex = data.replace(/\s+/g, '')
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      throw new Error('Invalid hex string')
    }
    return Buffer.from(cleanHex, 'hex')
  } else {
    // UTF-8 encoding
    return Buffer.from(data, 'utf-8')
  }
}

/**
 * Create OP_RETURN script
 * OP_RETURN opcode is 0x6a
 */
export function createOpReturnScript(data: string, encoding: 'utf-8' | 'hex' = 'utf-8'): Buffer {
  const encodedData = encodeOpReturnData(data, encoding)
  
  // OP_RETURN has a 80-byte limit for data
  if (encodedData.length > 80) {
    throw new Error('OP_RETURN data cannot exceed 80 bytes')
  }
  
  // Build script: OP_RETURN <data>
  const script = bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    encodedData,
  ])
  
  return Buffer.from(script)
}

/**
 * Calculate OP_RETURN transaction size
 */
export function estimateOpReturnTxSize(
  inputCount: number,
  hasChangeOutput: boolean,
  opReturnDataSize: number
): number {
  // Base transaction size
  const baseSize = 10
  
  // Input size (taproot with witness)
  const inputSize = 58 + Math.ceil(97 / 4) // ~82 vBytes per input
  const totalInputSize = inputCount * inputSize
  
  // OP_RETURN output size (value + script length + script)
  const opReturnOutputSize = 8 + 1 + (1 + opReturnDataSize) // value(8) + scriptLen(1) + OP_RETURN(1) + data
  
  // Change output size (if needed)
  const changeOutputSize = hasChangeOutput ? 43 : 0
  
  // Witness data
  const witnessSize = inputCount * 97
  const witnessVBytes = Math.ceil(witnessSize / 4)
  
  const totalVBytes = baseSize + totalInputSize + opReturnOutputSize + changeOutputSize + witnessVBytes
  
  return totalVBytes
}

/**
 * Calculate fee for OP_RETURN transaction
 */
export function calculateOpReturnFee(
  inputCount: number,
  hasChangeOutput: boolean,
  opReturnDataSize: number,
  feeRate: number
): number {
  const size = estimateOpReturnTxSize(inputCount, hasChangeOutput, opReturnDataSize)
  return Math.ceil(size * feeRate)
}

