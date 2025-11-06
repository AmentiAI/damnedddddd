/**
 * Sandshrew Esplora (Block Explorer) API Utilities
 * 
 * These utilities provide easy access to Sandshrew's esplora endpoints
 * for transaction, address, block, and mempool queries.
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'

// Transaction Types
export interface Transaction {
  txid: string
  version: number
  locktime: number
  vin: TransactionInput[]
  vout: TransactionOutput[]
  size: number
  weight: number
  fee: number
  status: TransactionStatus
}

export interface TransactionInput {
  txid: string
  vout: number
  prevout: TransactionOutput | null
  scriptsig: string
  scriptsig_asm: string
  witness: string[]
  is_coinbase: boolean
  sequence: number
}

export interface TransactionOutput {
  scriptpubkey: string
  scriptpubkey_asm: string
  scriptpubkey_type: string
  scriptpubkey_address: string
  value: number
}

export interface TransactionStatus {
  confirmed: boolean
  block_height?: number
  block_hash?: string
  block_time?: number
}

export interface Outspend {
  spent: boolean
  txid?: string
  vin?: number
  status?: TransactionStatus
}

// Address Types
export interface AddressInfo {
  address: string
  chain_stats: AddressStats
  mempool_stats: AddressStats
}

export interface AddressStats {
  funded_txo_count: number
  funded_txo_sum: number
  spent_txo_count: number
  spent_txo_sum: number
  tx_count: number
}

// Block Types
export interface BlockInfo {
  id: string
  height: number
  version: number
  timestamp: number
  tx_count: number
  size: number
  weight: number
  merkle_root: string
  previousblockhash: string
  mediantime: number
  nonce: number
  bits: number
  difficulty: number
}

export interface BlockStatus {
  in_best_chain: boolean
  height: number
  next_best?: string
}

// Mempool Types
export interface MempoolStats {
  count: number
  vsize: number
  total_fee: number
  fee_histogram: Array<[number, number]>
}

export interface MempoolTransaction {
  txid: string
  fee: number
  vsize: number
  value: number
}

// Fee Types
export interface FeeEstimates {
  [key: string]: number // confirmation target -> fee rate (sat/vB)
}

// Transaction Methods
export async function getTransaction(
  client: LaserEyesClient,
  txid: string
): Promise<Transaction> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_tx', [txid])
  return response.result as Transaction
}

export async function getTransactionStatus(
  client: LaserEyesClient,
  txid: string
): Promise<TransactionStatus> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_tx::status', [txid])
  return response.result as TransactionStatus
}

export async function getTransactionHex(
  client: LaserEyesClient,
  txid: string
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_tx::hex', [txid])
  return response.result as string
}

export async function getTransactionRaw(
  client: LaserEyesClient,
  txid: string
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_tx::raw', [txid])
  return response.result as string
}

export async function getTransactionOutspends(
  client: LaserEyesClient,
  txid: string
): Promise<Outspend[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_tx::outspends', [txid])
  return response.result as Outspend[]
}

export async function getTransactionOutspend(
  client: LaserEyesClient,
  txid: string,
  vout: number
): Promise<Outspend> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_tx::outspend', [txid, vout.toString()])
  return response.result as Outspend
}

// Address Methods
export async function getAddressInfo(
  client: LaserEyesClient,
  address: string
): Promise<AddressInfo> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_address', [address])
  return response.result as AddressInfo
}

export async function getAddressTransactions(
  client: LaserEyesClient,
  address: string
): Promise<Transaction[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_address::txs', [address])
  return response.result as Transaction[]
}

export async function getAddressConfirmedTransactions(
  client: LaserEyesClient,
  address: string
): Promise<Transaction[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_address::txs:chain', [address])
  return response.result as Transaction[]
}

export async function getAddressMempoolTransactions(
  client: LaserEyesClient,
  address: string
): Promise<Transaction[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_address::txs:mempool', [address])
  return response.result as Transaction[]
}

export async function getAddressUTXOs(
  client: LaserEyesClient,
  address: string
): Promise<Array<{ txid: string; vout: number; status: TransactionStatus; value: number }>> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_address::utxo', [address])
  return response.result
}

// Block Methods
export async function getBlockInfo(
  client: LaserEyesClient,
  blockHash: string
): Promise<BlockInfo> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_block', [blockHash])
  return response.result as BlockInfo
}

export async function getBlockHeader(
  client: LaserEyesClient,
  blockHash: string
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_block::header', [blockHash])
  return response.result as string
}

export async function getBlockStatus(
  client: LaserEyesClient,
  blockHash: string
): Promise<BlockStatus> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_block::status', [blockHash])
  return response.result as BlockStatus
}

export async function getBlockTransactions(
  client: LaserEyesClient,
  blockHash: string,
  startIndex?: number
): Promise<Transaction[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = startIndex !== undefined
    ? [blockHash, startIndex.toString()]
    : [blockHash]

  const response = await sandshrew.call('esplora_block::txs', params)
  return response.result as Transaction[]
}

export async function getBlockTxIds(
  client: LaserEyesClient,
  blockHash: string
): Promise<string[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_block::txids', [blockHash])
  return response.result as string[]
}

export async function getBlockTxId(
  client: LaserEyesClient,
  blockHash: string,
  index: number
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_block::txid', [blockHash, index.toString()])
  return response.result as string
}

export async function getBlockHashByHeight(
  client: LaserEyesClient,
  height: number
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_block-height', [height.toString()])
  return response.result as string
}

export async function getBlocks(
  client: LaserEyesClient,
  startHeight?: number
): Promise<BlockInfo[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = startHeight !== undefined ? [startHeight.toString()] : []
  const response = await sandshrew.call('esplora_blocks', params)
  return response.result as BlockInfo[]
}

export async function getBlockTipHeight(client: LaserEyesClient): Promise<number> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_blocks:tip:height', [])
  return response.result as number
}

export async function getBlockTipHash(client: LaserEyesClient): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_blocks:tip:hash', [])
  return response.result as string
}

// Mempool Methods
export async function getMempoolStats(client: LaserEyesClient): Promise<MempoolStats> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_mempool', [])
  return response.result as MempoolStats
}

export async function getMempoolTxIds(client: LaserEyesClient): Promise<string[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_mempool:txids', [])
  return response.result as string[]
}

export async function getMempoolRecentTransactions(
  client: LaserEyesClient
): Promise<MempoolTransaction[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_mempool:recent', [])
  return response.result as MempoolTransaction[]
}

// Fee Methods
export async function getFeeEstimates(client: LaserEyesClient): Promise<FeeEstimates> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('esplora_fee-estimates', [])
  return response.result as FeeEstimates
}

// Helper Functions
/**
 * Check if a transaction is confirmed
 */
export async function isTransactionConfirmed(
  client: LaserEyesClient,
  txid: string
): Promise<boolean> {
  const status = await getTransactionStatus(client, txid)
  return status.confirmed
}

/**
 * Get fee rate for a specific confirmation target
 */
export async function getFeeRateForTarget(
  client: LaserEyesClient,
  target: number
): Promise<number | null> {
  const estimates = await getFeeEstimates(client)
  return estimates[target.toString()] || null
}

/**
 * Get recommended fee rate (fastest confirmation)
 */
export async function getRecommendedFeeRate(client: LaserEyesClient): Promise<number> {
  const estimates = await getFeeEstimates(client)
  // Return fee for 1 block confirmation (fastest)
  return estimates['1'] || 1
}

