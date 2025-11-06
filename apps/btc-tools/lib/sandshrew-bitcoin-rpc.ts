/**
 * Sandshrew Bitcoin RPC API Utilities
 * 
 * These utilities provide access to Sandshrew's Bitcoin Core JSON-RPC endpoints
 * for transaction building, PSBT operations, mempool queries, and more.
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'

// Block Types
export interface BlockInfo {
  hash: string
  confirmations: number
  height: number
  version: number
  versionHex: string
  merkleroot: string
  time: number
  mediantime: number
  nonce: number
  bits: string
  difficulty: number
  chainwork: string
  nTx: number
  previousblockhash?: string
  nextblockhash?: string
  strippedsize: number
  size: number
  weight: number
  tx?: string[]
}

export interface BlockHeader {
  hash: string
  confirmations: number
  height: number
  version: number
  versionHex: string
  merkleroot: string
  time: number
  mediantime: number
  nonce: number
  bits: string
  difficulty: number
  chainwork: string
  nTx: number
  previousblockhash?: string
  nextblockhash?: string
}

export interface BlockchainInfo {
  chain: string
  blocks: number
  headers: number
  bestblockhash: string
  difficulty: number
  time: number
  mediantime: number
  verificationprogress: number
  initialblockdownload: boolean
  chainwork: string
  size_on_disk: number
  pruned: boolean
  warnings: string
}

export interface ChainTip {
  height: number
  hash: string
  branchlen: number
  status: 'invalid' | 'headers-only' | 'valid-headers' | 'valid-fork' | 'active'
}

// Mempool Types
export interface MempoolEntry {
  vsize: number
  weight: number
  time: number
  height: number
  descendantcount: number
  descendantsize: number
  ancestorcount: number
  ancestorsize: number
  wtxid: string
  fees: {
    base: number
    modified: number
    ancestor: number
    descendant: number
  }
  depends?: string[]
  spentby?: string[]
  'bip125-replaceable': boolean
  unbroadcast: boolean
}

export interface MempoolInfo {
  loaded: boolean
  size: number
  bytes: number
  usage: number
  total_fee: number
  maxmempool: number
  mempoolminfee: number
  minrelaytxfee: number
  incrementalrelayfee: number
  unbroadcastcount: number
  fullrbf: boolean
}

// PSBT Types
export interface PSBTAnalysis {
  inputs: Array<{
    has_utxo: boolean
    is_final: boolean
    next: string
  }>
  fee?: number
  next: string
}

export interface DecodedPSBT {
  tx: any
  inputs: any[]
  outputs: any[]
  fee?: number
}

// Transaction Types
export interface DecodedTransaction {
  txid: string
  hash: string
  version: number
  size: number
  vsize: number
  weight: number
  locktime: number
  vin: any[]
  vout: any[]
}

export interface TxOut {
  bestblock: string
  confirmations: number
  value: number
  scriptPubKey: {
    asm: string
    desc: string
    hex: string
    address?: string
    type: string
  }
  coinbase: boolean
}

// Block Methods
export async function getBlock(
  client: LaserEyesClient,
  blockHash: string,
  verbosity: number = 1
): Promise<BlockInfo | string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getblock', [blockHash, verbosity])
  return response.result
}

export async function getBestBlockHash(client: LaserEyesClient): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getbestblockhash', [])
  return response.result
}

export async function getBlockchainInfo(client: LaserEyesClient): Promise<BlockchainInfo> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getblockchaininfo', [])
  return response.result
}

export async function getBlockCount(client: LaserEyesClient): Promise<number> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getblockcount', [])
  return response.result
}

export async function getBlockHash(
  client: LaserEyesClient,
  height: number
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getblockhash', [height])
  return response.result
}

export async function getBlockHeader(
  client: LaserEyesClient,
  blockHash: string,
  verbose: boolean = true
): Promise<BlockHeader | string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getblockheader', [blockHash, verbose])
  return response.result
}

export async function getChainTips(client: LaserEyesClient): Promise<ChainTip[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getchaintips', [])
  return response.result
}

// Mempool Methods
export async function getMempoolAncestors(
  client: LaserEyesClient,
  txid: string,
  verbose: boolean = true
): Promise<Record<string, MempoolEntry> | string[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getmempoolancestors', [txid, verbose])
  return response.result
}

export async function getMempoolDescendants(
  client: LaserEyesClient,
  txid: string,
  verbose: boolean = true
): Promise<Record<string, MempoolEntry> | string[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getmempooldescendants', [txid, verbose])
  return response.result
}

export async function getMempoolEntry(
  client: LaserEyesClient,
  txid: string
): Promise<MempoolEntry> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getmempoolentry', [txid])
  return response.result
}

export async function getMempoolInfo(client: LaserEyesClient): Promise<MempoolInfo> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getmempoolinfo', [])
  return response.result
}

export async function getRawMempool(
  client: LaserEyesClient,
  verbose: boolean = false
): Promise<string[] | Record<string, MempoolEntry>> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_getrawmempool', [verbose])
  return response.result
}

// Transaction Methods
export async function getRawTransaction(
  client: LaserEyesClient,
  txid: string,
  verbose: boolean = false,
  blockHash?: string
): Promise<string | DecodedTransaction> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = blockHash ? [txid, verbose, blockHash] : [txid, verbose]
  const response = await sandshrew.call('btc_getrawtransaction', params)
  return response.result
}

export async function getTxOut(
  client: LaserEyesClient,
  txid: string,
  vout: number
): Promise<TxOut | null> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_gettxout', [txid, vout])
  return response.result
}

export async function createRawTransaction(
  client: LaserEyesClient,
  inputs: Array<{ txid: string; vout: number; sequence?: number }>,
  outputs: Record<string, number | string>,
  locktime?: number,
  replaceable?: boolean
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params: any[] = [inputs, outputs]
  if (locktime !== undefined) params.push(locktime)
  if (replaceable !== undefined) params.push(replaceable)

  const response = await sandshrew.call('btc_createrawtransaction', params)
  return response.result
}

export async function decodeRawTransaction(
  client: LaserEyesClient,
  hexstring: string,
  iswitness?: boolean
): Promise<DecodedTransaction> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = iswitness !== undefined ? [hexstring, iswitness] : [hexstring]
  const response = await sandshrew.call('btc_decoderawtransaction', params)
  return response.result
}

export async function sendRawTransaction(
  client: LaserEyesClient,
  hexstring: string,
  maxfeerate?: number
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = maxfeerate !== undefined ? [hexstring, maxfeerate] : [hexstring]
  const response = await sandshrew.call('btc_sendrawtransaction', params)
  return response.result
}

export async function testMempoolAccept(
  client: LaserEyesClient,
  rawtxs: string[],
  maxfeerate?: number | string
): Promise<Array<{ txid: string; allowed: boolean; 'reject-reason'?: string }>> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = maxfeerate !== undefined ? [rawtxs, maxfeerate] : [rawtxs]
  const response = await sandshrew.call('btc_testmempoolaccept', params)
  return response.result
}

// PSBT Methods
export async function createPSBT(
  client: LaserEyesClient,
  inputs: Array<{ txid: string; vout: number }>,
  outputs: Record<string, number | string>,
  locktime?: number,
  replaceable?: boolean
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params: any[] = [inputs, outputs]
  if (locktime !== undefined) params.push(locktime)
  if (replaceable !== undefined) params.push(replaceable)

  const response = await sandshrew.call('btc_createpsbt', params)
  return response.result
}

export async function decodePSBT(
  client: LaserEyesClient,
  psbt: string
): Promise<DecodedPSBT> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_decodepsbt', [psbt])
  return response.result
}

export async function analyzePSBT(
  client: LaserEyesClient,
  psbt: string
): Promise<PSBTAnalysis> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_analyzepsbt', [psbt])
  return response.result
}

export async function combinePSBT(
  client: LaserEyesClient,
  psbts: string[]
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_combinepsbt', [psbts])
  return response.result
}

export async function finalizePSBT(
  client: LaserEyesClient,
  psbt: string,
  extract: boolean = true
): Promise<{
  psbt?: string
  hex?: string
  complete: boolean
}> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_finalizepsbt', [psbt, extract])
  return response.result
}

export async function convertToPSBT(
  client: LaserEyesClient,
  hexstring: string,
  permitsigdata?: boolean,
  iswitness?: boolean
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params: any[] = [hexstring]
  if (permitsigdata !== undefined) params.push(permitsigdata)
  if (iswitness !== undefined) params.push(iswitness)

  const response = await sandshrew.call('btc_converttopsbt', params)
  return response.result
}

export async function utxoUpdatePSBT(
  client: LaserEyesClient,
  psbt: string,
  descriptors?: string[]
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = descriptors ? [psbt, descriptors] : [psbt]
  const response = await sandshrew.call('btc_utxoupdatepsbt', params)
  return response.result
}

// Utility Methods
export async function validateAddress(
  client: LaserEyesClient,
  address: string
): Promise<{
  isvalid: boolean
  address?: string
  scriptPubKey?: string
  isscript?: boolean
  iswitness?: boolean
  witness_version?: number
  witness_program?: string
  [key: string]: any
}> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_validateaddress', [address])
  return response.result
}

export async function estimateSmartFee(
  client: LaserEyesClient,
  confTarget: number,
  estimateMode: 'UNSET' | 'ECONOMICAL' | 'CONSERVATIVE' = 'CONSERVATIVE'
): Promise<{
  feerate?: number
  errors?: string[]
  blocks?: number
}> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('btc_estimatesmartfee', [confTarget, estimateMode])
  return response.result
}

// Helper Functions
/**
 * Check if a transaction is in the mempool
 */
export async function isTransactionInMempool(
  client: LaserEyesClient,
  txid: string
): Promise<boolean> {
  try {
    await getMempoolEntry(client, txid)
    return true
  } catch {
    return false
  }
}

/**
 * Get transaction ancestors (for CPFP)
 */
export async function getTransactionAncestors(
  client: LaserEyesClient,
  txid: string
): Promise<MempoolEntry[]> {
  const ancestors = await getMempoolAncestors(client, txid, true)
  if (Array.isArray(ancestors)) {
    return []
  }
  return Object.values(ancestors)
}

/**
 * Get transaction descendants (for RBF detection)
 */
export async function getTransactionDescendants(
  client: LaserEyesClient,
  txid: string
): Promise<MempoolEntry[]> {
  const descendants = await getMempoolDescendants(client, txid, true)
  if (Array.isArray(descendants)) {
    return []
  }
  return Object.values(descendants)
}

