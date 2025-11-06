/**
 * UTXO Recovery Utilities
 * 
 * Accurate transaction size and fee calculation for UTXO recovery
 */

import * as bitcoin from 'bitcoinjs-lib'
import { MAINNET, TESTNET } from '@omnisat/lasereyes-core'
import type { NetworkType } from '@omnisat/lasereyes-core'

/**
 * Detect address type
 */
export function getAddressType(address: string, network: NetworkType): 'p2tr' | 'p2wpkh' | 'p2sh' | 'p2pkh' {
  try {
    // Check by prefix first (fastest)
    if (address.startsWith('bc1p') || address.startsWith('tb1p')) {
      return 'p2tr' // Taproot
    } else if (address.startsWith('bc1') || address.startsWith('tb1')) {
      // Could be P2WPKH or P2TR, need to check version
      try {
        const decoded = bitcoin.address.fromBech32(address)
        if (decoded.version === 1) {
          return 'p2tr'
        }
        return 'p2wpkh'
      } catch {
        return 'p2wpkh' // Default for bech32
      }
    } else if (address.startsWith('3') || address.startsWith('2')) {
      return 'p2sh' // P2SH
    } else if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n')) {
      return 'p2pkh' // Legacy
    }
    
    // Try to decode to determine
    try {
      bitcoin.address.fromBase58Check(address)
      return 'p2pkh' // Default fallback for base58
    } catch {
      // Try bech32
      try {
        const decoded = bitcoin.address.fromBech32(address)
        if (decoded.version === 1) {
          return 'p2tr'
        }
        return 'p2wpkh'
      } catch {
        return 'p2pkh' // Default fallback
      }
    }
  } catch {
    return 'p2pkh' // Default fallback
  }
}

/**
 * Calculate exact transaction size in vBytes
 * This ensures 1 sat/vB = 1 sat per vByte
 */
export function calculateExactTxSize(
  inputAddressType: 'p2tr' | 'p2wpkh' | 'p2sh' | 'p2pkh',
  outputAddressType: 'p2tr' | 'p2wpkh' | 'p2sh' | 'p2pkh',
  inputCount: number = 1,
  outputCount: number = 1
): number {
  // Base transaction size (version + locktime + input count + output count)
  const baseSize = 4 + 4 + 1 + 1 // 10 bytes
  
  // Input sizes (in vBytes, accounting for witness discount)
  let inputVBytes = 0
  
  switch (inputAddressType) {
    case 'p2tr':
      // Taproot input (P2TR):
      // - Outpoint: 32 (prevout hash) + 4 (index) = 36 bytes
      // - Script length: 1 byte (0x00 for empty script)
      // - Sequence: 4 bytes
      // - Total non-witness: 36 + 1 + 4 = 41 bytes
      // - Witness: 64 (signature) + 33 (public key) = 97 bytes
      // - Witness vBytes = 97 / 4 = 24.25 vBytes (round up to 25)
      // - Total: 41 + 25 = 66 vBytes
      inputVBytes = 66
      break
    case 'p2wpkh':
      // Native SegWit input (P2WPKH):
      // - Outpoint: 32 + 4 = 36 bytes
      // - Script length: 1 byte (0x16 for 22-byte script)
      // - Sequence: 4 bytes
      // - Total non-witness: 36 + 1 + 4 = 41 bytes
      // - Witness: 27 (signature) + 33 (public key) = 60 bytes
      // - Witness vBytes = 60 / 4 = 15 vBytes
      // - Total: 41 + 15 = 56 vBytes
      inputVBytes = 56
      break
    case 'p2sh':
      // P2SH-P2WPKH input (nested SegWit):
      // - Outpoint: 32 + 4 = 36 bytes
      // - Script length: 1 byte (0x17 for 23-byte redeem script)
      // - Redeem script: 23 bytes
      // - Sequence: 4 bytes
      // - Total non-witness: 36 + 1 + 23 + 4 = 64 bytes
      // - Witness: 27 + 33 = 60 bytes = 15 vBytes
      // - Total: 64 + 15 = 79 vBytes
      inputVBytes = 79
      break
    case 'p2pkh':
      // Legacy input (P2PKH):
      // - Outpoint: 32 + 4 = 36 bytes
      // - Script length: 1 byte (0x6b for 107-byte script)
      // - Script: 107 bytes (signature + public key)
      // - Sequence: 4 bytes
      // - Total: 36 + 1 + 107 + 4 = 148 bytes (no witness discount)
      inputVBytes = 148
      break
  }
  
  // Output sizes
  let outputVBytes = 0
  
  switch (outputAddressType) {
    case 'p2tr':
      // Taproot output: 8 (value) + 1 (script length) + 34 (script) = 43 bytes
      outputVBytes = 43
      break
    case 'p2wpkh':
      // Native SegWit output: 8 + 1 + 22 = 31 bytes
      outputVBytes = 31
      break
    case 'p2sh':
      // P2SH output: 8 + 1 + 23 = 32 bytes
      outputVBytes = 32
      break
    case 'p2pkh':
      // Legacy output: 8 + 1 + 25 = 34 bytes
      outputVBytes = 34
      break
  }
  
  const totalVBytes = baseSize + (inputVBytes * inputCount) + (outputVBytes * outputCount)
  
  return totalVBytes
}

/**
 * Calculate fee for UTXO recovery transaction
 * Ensures 1 sat/vB = 1 sat per vByte
 */
export function calculateRecoveryFee(
  inputAddress: string,
  outputAddress: string,
  feeRate: number, // sat/vB
  network: NetworkType
): {
  vBytes: number
  fee: number
  feeRate: number
} {
  const inputType = getAddressType(inputAddress, network)
  const outputType = getAddressType(outputAddress, network)
  
  // Single input, single output transaction
  const vBytes = calculateExactTxSize(inputType, outputType, 1, 1)
  
  // Fee = feeRate * vBytes (ensuring 1 sat/vB = 1 sat per vByte)
  // Use Math.ceil to ensure we don't underpay (Bitcoin fees are always rounded up)
  const fee = Math.ceil(feeRate * vBytes)
  
  return {
    vBytes,
    fee,
    feeRate,
  }
}

/**
 * Calculate destination amount after fee deduction
 */
export function calculateDestinationAmount(
  utxoValue: number,
  fee: number
): {
  destinationAmount: number
  fee: number
  utxoValue: number
} {
  const destinationAmount = utxoValue - fee
  
  return {
    destinationAmount: Math.max(0, destinationAmount),
    fee,
    utxoValue,
  }
}

