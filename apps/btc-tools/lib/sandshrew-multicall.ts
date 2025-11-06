/**
 * Sandshrew Multicall Utilities
 * 
 * Batch multiple API calls into a single request for improved performance.
 * Supports all Sandshrew namespaces: ord, esplora, btc
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'

export interface MulticallRequest {
  method: string
  params: any[]
}

export interface MulticallResponse {
  result?: any
  error?: {
    code: number
    message: string
  }
}

/**
 * Execute multiple RPC calls in a single request
 * 
 * @example
 * ```typescript
 * const results = await multicall(client, [
 *   { method: 'esplora_tx', params: ['txid1'] },
 *   { method: 'esplora_tx', params: ['txid2'] },
 *   { method: 'ord_inscription', params: ['inscriptionId'] },
 * ])
 * ```
 */
export async function multicall(
  client: LaserEyesClient,
  requests: MulticallRequest[]
): Promise<MulticallResponse[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.multicall) {
    throw new Error('Sandshrew data source not available or multicall not supported')
  }

  // Format requests for multicall: [[method, params], ...]
  const formattedRequests = requests.map(req => [req.method, req.params])
  
  const response = await sandshrew.multicall(formattedRequests)
  return response
}

/**
 * Batch fetch multiple transactions
 */
export async function batchGetTransactions(
  client: LaserEyesClient,
  txids: string[]
): Promise<Array<{ txid: string; transaction?: any; error?: any }>> {
  const requests = txids.map(txid => ({
    method: 'esplora_tx',
    params: [txid],
  }))

  const results = await multicall(client, requests)
  
  return txids.map((txid, index) => ({
    txid,
    transaction: results[index].result,
    error: results[index].error,
  }))
}

/**
 * Batch fetch multiple transaction statuses
 */
export async function batchGetTransactionStatuses(
  client: LaserEyesClient,
  txids: string[]
): Promise<Array<{ txid: string; status?: any; error?: any }>> {
  const requests = txids.map(txid => ({
    method: 'esplora_tx::status',
    params: [txid],
  }))

  const results = await multicall(client, requests)
  
  return txids.map((txid, index) => ({
    txid,
    status: results[index].result,
    error: results[index].error,
  }))
}

/**
 * Batch fetch multiple inscriptions
 */
export async function batchGetInscriptions(
  client: LaserEyesClient,
  inscriptionIds: string[]
): Promise<Array<{ inscriptionId: string; info?: any; error?: any }>> {
  const requests = inscriptionIds.map(id => ({
    method: 'ord_inscription',
    params: [id],
  }))

  const results = await multicall(client, requests)
  
  return inscriptionIds.map((id, index) => ({
    inscriptionId: id,
    info: results[index].result,
    error: results[index].error,
  }))
}

/**
 * Batch fetch multiple addresses
 */
export async function batchGetAddressInfo(
  client: LaserEyesClient,
  addresses: string[]
): Promise<Array<{ address: string; info?: any; error?: any }>> {
  const requests = addresses.map(address => ({
    method: 'esplora_address',
    params: [address],
  }))

  const results = await multicall(client, requests)
  
  return addresses.map((address, index) => ({
    address,
    info: results[index].result,
    error: results[index].error,
  }))
}

/**
 * Batch fetch multiple UTXOs
 */
export async function batchGetUTXOs(
  client: LaserEyesClient,
  utxos: Array<{ txid: string; vout: number }>
): Promise<Array<{ txid: string; vout: number; utxo?: any; error?: any }>> {
  const requests = utxos.map(utxo => ({
    method: 'btc_gettxout',
    params: [utxo.txid, utxo.vout],
  }))

  const results = await multicall(client, requests)
  
  return utxos.map((utxo, index) => ({
    ...utxo,
    utxo: results[index].result,
    error: results[index].error,
  }))
}

/**
 * Batch check mempool entries
 */
export async function batchCheckMempool(
  client: LaserEyesClient,
  txids: string[]
): Promise<Array<{ txid: string; inMempool: boolean; entry?: any; error?: any }>> {
  const requests = txids.map(txid => ({
    method: 'btc_getmempoolentry',
    params: [txid],
  }))

  const results = await multicall(client, requests)
  
  return txids.map((txid, index) => ({
    txid,
    inMempool: !results[index].error && results[index].result !== null,
    entry: results[index].result,
    error: results[index].error,
  }))
}

/**
 * Mixed batch call - combine different types of requests
 */
export async function mixedMulticall(
  client: LaserEyesClient,
  requests: MulticallRequest[]
): Promise<MulticallResponse[]> {
  return await multicall(client, requests)
}

