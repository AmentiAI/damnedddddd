/**
 * CPFP (Child Pays For Parent) Utilities
 * 
 * Functions for building child transactions to incentivize parent confirmation
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'
import { getTransaction, getTransactionStatus, getTransactionOutspends } from './sandshrew-esplora'
import type { Transaction } from './sandshrew-esplora'

export interface CPFPTransaction {
  txid: string
  transaction: Transaction
  spendableOutputs: Array<{
    vout: number
    address: string
    value: number
    scriptPubKey: string
  }>
  recommendedFee: number
}

/**
 * Check if a transaction is eligible for CPFP
 * - Must be unconfirmed (in mempool)
 * - Must have at least one output to the user's address
 */
export async function isCPFPEligible(
  client: LaserEyesClient,
  txid: string,
  userAddress: string
): Promise<{ eligible: boolean; reason?: string; transaction?: CPFPTransaction }> {
  try {
    // Check if transaction is confirmed
    const status = await getTransactionStatus(client, txid)
    if (status.confirmed) {
      return { eligible: false, reason: 'Transaction is already confirmed' }
    }

    // Get transaction details
    const tx = await getTransaction(client, txid)
    
    // Find outputs to user's address
    const spendableOutputs = tx.vout
      .map((output, index) => ({
        vout: index,
        address: output.scriptpubkey_address || '',
        value: output.value,
        scriptPubKey: output.scriptpubkey,
      }))
      .filter(output => output.address === userAddress && output.value > 546)

    if (spendableOutputs.length === 0) {
      return {
        eligible: false,
        reason: 'No spendable outputs found to your address',
      }
    }

    // Check if output is already spent
    const outspends = await getTransactionOutspends(client, txid)
    const unspentOutputs = spendableOutputs.filter(
      (output) => !outspends[output.vout]?.spent
    )

    if (unspentOutputs.length === 0) {
      return {
        eligible: false,
        reason: 'All outputs to your address are already spent',
      }
    }

    // Calculate recommended fee (high fee to incentivize confirmation)
    const totalOutputValue = unspentOutputs.reduce((sum, out) => sum + out.value, 0)
    const recommendedFee = Math.min(Math.floor(totalOutputValue * 0.5), 10000) // 50% of output or 10k sats max

    return {
      eligible: true,
      transaction: {
        txid,
        transaction: tx,
        spendableOutputs: unspentOutputs,
        recommendedFee,
      },
    }
  } catch (error: any) {
    return { eligible: false, reason: error.message || 'Could not check CPFP eligibility' }
  }
}


/**
 * Calculate CPFP fee
 * Higher fee = higher priority for parent confirmation
 */
export function calculateCPFPFee(
  outputValue: number,
  feeRate: number,
  txSize: number = 250 // Estimated child transaction size
): { fee: number; totalCost: number; remainingValue: number } {
  const fee = Math.ceil(txSize * feeRate)
  const totalCost = fee
  const remainingValue = outputValue - fee

  return {
    fee,
    totalCost,
    remainingValue: Math.max(0, remainingValue),
  }
}

