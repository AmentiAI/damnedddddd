/**
 * Sandshrew Ord (Inscriptions/Runes) API Utilities
 * 
 * These utilities provide easy access to Sandshrew's ord endpoints
 * for inscription and rune operations.
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'

export interface InscriptionInfo {
  address: string
  children: string[]
  content_length: number
  content_type: string
  genesis_fee: number
  genesis_height: number
  inscription_id: string
  inscription_number: number
  next: string | null
  output_value: number
  parent: string | null
  previous: string | null
  rune: string | null
  sat: number
  satpoint: string
  timestamp: number
}

export interface OrdOutput {
  value: number
  script_pubkey: string
  address: string
  transaction: string
  sat_ranges: number[][]
  inscriptions: string[]
  runes: Record<string, any>
}

export interface InscriptionsByBlock {
  hash: string
  target: string
  best_height: number
  height: number
  inscriptions: string[]
}

export interface InscriptionsByPage {
  ids: string[]
  more: boolean
  page_index: number
}

export interface SatInfo {
  number: number
  decimal: string
  degree: string
  name: string
  block: number
  cycle: number
  epoch: number
  period: number
  offset: number
  rarity: string
  percentile: string
  satpoint: string | null
  timestamp: number
  inscriptions: string[]
}

/**
 * Get inscription info by ID or number
 */
export async function getInscription(
  client: LaserEyesClient,
  inscriptionIdOrNumber: string
): Promise<InscriptionInfo> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_inscription', [inscriptionIdOrNumber])
  return response.result as InscriptionInfo
}

/**
 * Get multiple inscription infos by batch
 */
export async function getInscriptionsBatch(
  client: LaserEyesClient,
  inscriptionIds: string[]
): Promise<InscriptionInfo[]> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.batchOrdInscriptionInfo) {
    throw new Error('Sandshrew data source not available')
  }

  return await sandshrew.batchOrdInscriptionInfo(inscriptionIds)
}

/**
 * Get inscriptions by block height
 */
export async function getInscriptionsByBlock(
  client: LaserEyesClient,
  blockHeight: number
): Promise<InscriptionsByBlock> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_inscriptions:block', [blockHeight.toString()])
  return response.result as InscriptionsByBlock
}

/**
 * Get inscriptions by block hash
 */
export async function getInscriptionsByBlockHash(
  client: LaserEyesClient,
  blockHash: string
): Promise<InscriptionsByBlock> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_block', [blockHash])
  return response.result as InscriptionsByBlock
}

/**
 * Get ord output (UTXO with inscription/rune info)
 */
export async function getOrdOutput(
  client: LaserEyesClient,
  outpoint: string
): Promise<OrdOutput> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_output', [outpoint])
  return response.result as OrdOutput
}

/**
 * Get child inscriptions
 */
export async function getInscriptionChildren(
  client: LaserEyesClient,
  inscriptionId: string,
  page?: number
): Promise<{ ids: string[]; more: boolean; page: number }> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = page !== undefined 
    ? [inscriptionId, page.toString()]
    : [inscriptionId]

  const response = await sandshrew.call('ord_r:children', params)
  return response.result
}

/**
 * Get inscriptions by sat number
 */
export async function getInscriptionsBySat(
  client: LaserEyesClient,
  satNumber: string | number,
  page?: number
): Promise<{ ids: string[]; more: boolean; page: number }> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const params = page !== undefined
    ? [satNumber.toString(), page.toString()]
    : [satNumber.toString()]

  const response = await sandshrew.call('ord_r:sat', params)
  return response.result
}

/**
 * Get inscription at specific index on a sat
 */
export async function getInscriptionBySatIndex(
  client: LaserEyesClient,
  satNumber: string | number,
  index: number
): Promise<{ id: string }> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_r:sat::at', [
    satNumber.toString(),
    index.toString(),
  ])
  return response.result
}

/**
 * Get sat information by number, decimal, degree, name, or percentile
 */
export async function getSatInfo(
  client: LaserEyesClient,
  satIdentifier: string | number
): Promise<SatInfo> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_sat', [satIdentifier.toString()])
  return response.result as SatInfo
}

/**
 * Get inscription content (base64 encoded)
 */
export async function getInscriptionContent(
  client: LaserEyesClient,
  inscriptionId: string
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_content', [inscriptionId])
  return response.result as string
}

/**
 * Get inscription preview HTML
 */
export async function getInscriptionPreview(
  client: LaserEyesClient,
  inscriptionId: string
): Promise<string> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_preview', [inscriptionId])
  return response.result as string
}

/**
 * Get inscriptions by page index
 * Returns a specified number of inscription IDs, ordered by their inscription number
 * 
 * @param pageIndex - The page index (inscription number to start from)
 */
export async function getInscriptionsByPage(
  client: LaserEyesClient,
  pageIndex: number | string
): Promise<InscriptionsByPage> {
  const sandshrew = client.dataSourceManager.getSource('sandshrew') as any
  if (!sandshrew || !sandshrew.call) {
    throw new Error('Sandshrew data source not available')
  }

  const response = await sandshrew.call('ord_inscriptions', [pageIndex.toString()])
  return response.result as InscriptionsByPage
}

/**
 * Check if inscription UTXO has excess padding (> 5000 sats)
 */
export async function checkInscriptionPadding(
  client: LaserEyesClient,
  outpoint: string
): Promise<{ hasExcessPadding: boolean; excessSats: number; outputValue: number }> {
  const output = await getOrdOutput(client, outpoint)
  
  // Inscriptions typically need ~546 sats minimum
  // Excess padding is anything > 5000 sats
  const excessSats = output.value > 5000 ? output.value - 5000 : 0
  
  return {
    hasExcessPadding: excessSats > 0,
    excessSats,
    outputValue: output.value,
  }
}

/**
 * Find all inscription UTXOs with excess padding
 */
export async function findInscriptionUTXOsWithPadding(
  client: LaserEyesClient,
  address: string
): Promise<Array<{ outpoint: string; inscriptionId: string; excessSats: number; outputValue: number }>> {
  const utxos = await client.dataSourceManager.getFormattedUTXOs(address)
  const results: Array<{ outpoint: string; inscriptionId: string; excessSats: number; outputValue: number }> = []

  for (const utxo of utxos) {
    if (utxo.hasInscriptions && utxo.btcValue > 5000) {
      const outpoint = `${utxo.txHash}:${utxo.txOutputIndex}`
      const excessSats = utxo.btcValue - 5000

      for (const inscription of utxo.inscriptions || []) {
        results.push({
          outpoint,
          inscriptionId: inscription.inscriptionId,
          excessSats,
          outputValue: utxo.btcValue,
        })
      }
    }
  }

  return results
}

