/**
 * Offer Utilities
 * 
 * Functions for creating and accepting inscription offers
 */

import * as bitcoin from 'bitcoinjs-lib'
import { getBitcoinNetwork } from '@omnisat/lasereyes-core'
import type { NetworkType } from '@omnisat/lasereyes-core'
import type { LaserEyesClient } from '@omnisat/lasereyes-core'
import { getInscription } from './sandshrew-ord'
import { estimateTransactionSize, calculateFee } from './fee-calculator'
import { getUTXOsForUseCase } from './utxo-selector'

export interface OfferDetails {
  inscriptionId: string
  offerPrice: number
  sellerAddress: string
  buyerAddress: string
}

/**
 * Create offer PSBT for buying an inscription
 * Compatible with ord node format
 * 
 * Structure:
 * - Inputs: Buyer's payment UTXOs
 * - Output 1: Payment to seller (offer price)
 * - Output 2: Inscription UTXO to seller (unsigned, will be signed by seller)
 * - Output 3: Change to buyer
 */
export async function createOfferPSBT(
  client: LaserEyesClient,
  inscriptionId: string,
  offerPrice: number,
  sellerAddress: string,
  buyerAddress: string,
  buyerPaymentAddress: string,
  buyerPaymentPublicKey: string,
  feeRate: number,
  network: NetworkType
): Promise<{
  psbtBase64: string
  psbtHex: string
  offerDetails: OfferDetails
}> {
  // Get inscription info
  const inscription = await getInscription(client, inscriptionId)
  if (!inscription) {
    throw new Error('Inscription not found')
  }

  // Verify seller address matches inscription owner
  if (inscription.address !== sellerAddress) {
    throw new Error('Seller address does not match inscription owner')
  }

  // Get buyer's payment UTXOs (from paymentAddress, >601 sats, confirmed, largest first)
  const paymentUtxos = await getUTXOsForUseCase(client, 'payment', {
    minValue: 601,
    requiredConfirmations: 1,
    sortOrder: 'largest-first',
  })
  
  if (paymentUtxos.length === 0) {
    throw new Error('No confirmed payment UTXOs available (value > 601 sats)')
  }

  // Convert to format expected by offer creation
  const sortedUtxos = paymentUtxos.map((utxo: any) => ({
    txid: utxo.txHash,
    vout: utxo.txOutputIndex,
    value: utxo.btcValue,
    scriptPubKey: utxo.scriptPubKey,
    tapInternalKey: utxo.tapInternalKey,
  }))

  // Calculate fee
  const inputCount = sortedUtxos.length + 1 // payment UTXOs + inscription input
  const outputCount = 3 // payment to seller + inscription output + change
  const sizeEstimate = estimateTransactionSize(inputCount, outputCount)
  const fee = calculateFee(feeRate, sizeEstimate.totalVBytes)

  // Gather enough UTXOs to cover offer price + fee
  let totalGathered = 0
  const selectedUtxos: any[] = []
  
  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo)
    totalGathered += utxo.value
    if (totalGathered >= offerPrice + fee + 1000) {
      break // Add some buffer
    }
  }

  if (totalGathered < offerPrice + fee) {
    throw new Error('Insufficient balance for offer and fees')
  }

  // Build PSBT
  const bitcoinNetwork = getBitcoinNetwork(network)
  const psbt = new bitcoin.Psbt({ network: bitcoinNetwork })

  // Add buyer's payment UTXOs as inputs
  for (const utxo of selectedUtxos) {
    const script = bitcoin.address.toOutputScript(buyerPaymentAddress, bitcoinNetwork)
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        value: BigInt(utxo.value),
        script,
      },
      tapInternalKey: Buffer.from(buyerPaymentPublicKey, 'hex').length === 33
        ? Buffer.from(buyerPaymentPublicKey, 'hex').subarray(1, 33) // Remove 0x02/0x03 prefix
        : Buffer.from(buyerPaymentPublicKey, 'hex'),
    })
  }

  // Add inscription UTXO as input (unsigned, will be signed by seller)
  // Parse satpoint to get txid and vout
  const [txid, voutStr] = inscription.satpoint.split(':')
  const vout = parseInt(voutStr || '0')
  
  const inscriptionScript = bitcoin.address.toOutputScript(sellerAddress, bitcoinNetwork)
  psbt.addInput({
    hash: txid,
    index: vout,
    witnessUtxo: {
      value: BigInt(inscription.output_value || 546),
      script: inscriptionScript,
    },
    // Note: tapInternalKey will be added by seller when they sign
  })

  // Output 1: Payment to seller
  psbt.addOutput({
    address: sellerAddress,
    value: BigInt(offerPrice),
  })

  // Output 2: Inscription to seller (will be transferred when seller signs)
  psbt.addOutput({
    address: sellerAddress,
    value: BigInt(inscription.output_value || 546),
  })

  // Output 3: Change to buyer
  const change = totalGathered - offerPrice - fee
  if (change > 546) {
    psbt.addOutput({
      address: buyerAddress,
      value: BigInt(change),
    })
  } else if (change < 0) {
    throw new Error('Insufficient balance for offer and fees')
  }

  return {
    psbtBase64: psbt.toBase64(),
    psbtHex: psbt.toHex(),
    offerDetails: {
      inscriptionId,
      offerPrice,
      sellerAddress,
      buyerAddress,
    },
  }
}

/**
 * Validate offer PSBT
 */
export function validateOfferPSBT(psbt: bitcoin.Psbt): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check inputs
  if (psbt.inputCount === 0) {
    errors.push('PSBT has no inputs')
  }

  // Check outputs
  if (psbt.txOutputs.length < 2) {
    errors.push('PSBT must have at least 2 outputs (payment + inscription)')
  }

  // Check that it's not fully signed
  const isFullySigned = psbt.txInputs.every((_input: bitcoin.PsbtTxInput, index) => {
    try {
      psbt.validateSignaturesOfInput(index, () => true)
      return true
    } catch {
      return false
    }
  })

  if (isFullySigned) {
    errors.push('Offer PSBT should not be fully signed (seller needs to sign)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

