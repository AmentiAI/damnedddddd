/**
 * RBF (Replace By Fee) Utilities
 * 
 * Functions for building replacement transactions with higher fees
 */

import * as bitcoin from 'bitcoinjs-lib'
import type { LaserEyesClient } from '@omnisat/lasereyes-core'
import { getRawTransaction, decodeRawTransaction } from './sandshrew-bitcoin-rpc'
import { getTransactionStatus, getTransaction } from './sandshrew-esplora'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import type { NetworkType } from '@omnisat/lasereyes-core'

export interface RBFTransaction {
  txid: string
  hex: string
  decoded: any
  inputs: Array<{
    txid: string
    vout: number
    sequence: number
  }>
  outputs: Array<{
    address: string
    value: number
  }>
  fee: number
  feeRate: number
}

/**
 * Check if a transaction is eligible for RBF
 * - Must be unconfirmed (in mempool)
 * - Must have sequence < 0xffffffff (not finalized)
 */
export async function isRBFEligible(
  client: LaserEyesClient,
  txid: string
): Promise<{ eligible: boolean; reason?: string; transaction?: any }> {
  try {
    // Check if transaction is confirmed
    const status = await getTransactionStatus(client, txid)
    if (status.confirmed) {
      return { eligible: false, reason: 'Transaction is already confirmed' }
    }

    // Get transaction details
    const tx = await getRawTransaction(client, txid, true)
    if (typeof tx === 'string') {
      throw new Error('Could not decode transaction')
    }

    // Check if any input has sequence < 0xffffffff
    const hasReplaceableInput = tx.vin.some((input: any) => {
      return input.sequence < 0xffffffff
    })

    if (!hasReplaceableInput) {
      return { eligible: false, reason: 'Transaction has finalized inputs (sequence = 0xffffffff)' }
    }

    return { eligible: true, transaction: tx }
  } catch (error: any) {
    return { eligible: false, reason: error.message || 'Could not check RBF eligibility' }
  }
}

/**
 * Get transaction details for RBF
 */
export async function getRBFTransaction(
  client: LaserEyesClient,
  txid: string
): Promise<RBFTransaction | null> {
  try {
    const status = await getTransactionStatus(client, txid)
    if (status.confirmed) {
      return null
    }

    // Get transaction from Esplora (includes fee and full details)
    const esploraTx = await getTransaction(client, txid)
    
    // Also get decoded transaction for structure
    const hex = await getRawTransaction(client, txid, false)
    if (typeof hex !== 'string') {
      return null
    }

    const decoded = await decodeRawTransaction(client, hex, true)
    
    // Use fee from Esplora (most accurate)
    const fee = esploraTx.fee || 0
    
    // Calculate vsize: use decoded vsize, or calculate from weight (weight / 4 = vsize)
    const vsize = decoded.vsize || (esploraTx.weight ? Math.ceil(esploraTx.weight / 4) : decoded.weight ? Math.ceil(decoded.weight / 4) : 1)
    const feeRate = vsize > 0 && fee > 0 ? Math.round(fee / vsize) : 0

    return {
      txid,
      hex,
      decoded,
      inputs: esploraTx.vin.map((input: any) => ({
        txid: input.txid,
        vout: input.vout,
        sequence: input.sequence,
      })),
      outputs: esploraTx.vout
        .filter((output: any) => output.scriptpubkey_type !== 'op_return')
        .map((output: any) => ({
          address: output.scriptpubkey_address || '',
          value: output.value,
        })),
      fee,
      feeRate,
    }
  } catch (error) {
    console.error('Error getting RBF transaction:', error)
    return null
  }
}

/**
 * Calculate minimum fee for RBF replacement
 * Must be higher than original fee + minimum relay fee
 */
export function calculateRBFFee(
  originalFee: number,
  originalVsize: number,
  newFeeRate: number
): { minFee: number; recommendedFee: number; newFee: number } {
  // Minimum relay fee increment (typically 1 sat/vB)
  const minRelayFee = originalVsize
  
  // Minimum fee must be original fee + minimum relay fee
  const minFee = originalFee + minRelayFee
  
  // New fee based on new fee rate
  const newFee = Math.ceil(originalVsize * newFeeRate)
  
  // Recommended fee (higher of minimum or new calculation)
  const recommendedFee = Math.max(minFee, newFee)
  
  return {
    minFee,
    recommendedFee,
    newFee,
  }
}

/**
 * Build RBF replacement transaction
 * Note: This creates the transaction structure, actual signing is done by wallet
 */
export function buildRBFTransaction(
  originalTx: RBFTransaction,
  newFeeRate: number,
  network: NetworkType
): {
  inputs: Array<{ txid: string; vout: number; sequence: number }>
  outputs: Record<string, number>
  locktime: number
  replaceable: boolean
} {
  const { minFee, recommendedFee } = calculateRBFFee(
    originalTx.fee,
    originalTx.decoded.vsize,
    newFeeRate
  )

  // Calculate total input value
  const totalInput = originalTx.inputs.reduce((sum, input) => {
    // We need to get the actual input value from the original transaction
    // For now, we'll estimate based on outputs + fee
    return sum
  }, 0)

  // Rebuild outputs with same addresses but adjust for new fee
  const outputs: Record<string, number> = {}
  
  // Calculate total output value (original outputs minus fee difference)
  const originalOutputTotal = originalTx.outputs.reduce((sum, out) => sum + out.value, 0)
  const feeDifference = recommendedFee - originalTx.fee
  
  // Adjust outputs proportionally or just reduce the last output
  originalTx.outputs.forEach((output, index) => {
    if (output.address) {
      if (index === originalTx.outputs.length - 1) {
        // Reduce last output by fee difference
        outputs[output.address] = Math.max(546, output.value - feeDifference)
      } else {
        outputs[output.address] = output.value
      }
    }
  })

  // Use same inputs with replaceable flag
  const inputs = originalTx.inputs.map(input => ({
    txid: input.txid,
    vout: input.vout,
    sequence: input.sequence, // Keep original sequence for RBF
  }))

  return {
    inputs,
    outputs,
    locktime: originalTx.decoded.locktime,
    replaceable: true,
  }
}

