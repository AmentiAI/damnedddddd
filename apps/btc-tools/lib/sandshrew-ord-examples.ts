/**
 * Sandshrew Ord API Examples
 * 
 * This file demonstrates how to use the Sandshrew ord endpoints
 * based on the official documentation.
 */

import type { LaserEyesClient } from '@omnisat/lasereyes-core'
import * as ord from './sandshrew-ord'

/**
 * Example: Get inscription by ID
 */
export async function exampleGetInscriptionById(client: LaserEyesClient) {
  const inscription = await ord.getInscription(
    client,
    '640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0'
  )
  console.log('Inscription:', inscription)
  return inscription
}

/**
 * Example: Get inscription by number
 */
export async function exampleGetInscriptionByNumber(client: LaserEyesClient) {
  const inscription = await ord.getInscription(client, '802285')
  console.log('Inscription:', inscription)
  return inscription
}

/**
 * Example: Get inscriptions by block height
 */
export async function exampleGetInscriptionsByBlock(client: LaserEyesClient) {
  const block = await ord.getInscriptionsByBlock(client, 780236)
  console.log('Block inscriptions:', block.inscriptions)
  return block
}

/**
 * Example: Get inscriptions by block hash
 */
export async function exampleGetInscriptionsByBlockHash(client: LaserEyesClient) {
  const block = await ord.getInscriptionsByBlockHash(
    client,
    '000000000000000000063a92390ee25a1f0b41ccaf4e675227acd864dc2eb3dd'
  )
  console.log('Block inscriptions:', block.inscriptions)
  return block
}

/**
 * Example: Get ord output (UTXO info)
 */
export async function exampleGetOrdOutput(client: LaserEyesClient) {
  const output = await ord.getOrdOutput(
    client,
    '22a0d4ad3fafb1eb53823b7655103bb7d6d7b61e9ac572e2f493bbdb8a371a09:0'
  )
  console.log('Output value:', output.value)
  console.log('Inscriptions:', output.inscriptions)
  console.log('Runes:', output.runes)
  return output
}

/**
 * Example: Get child inscriptions
 */
export async function exampleGetChildren(client: LaserEyesClient) {
  const children = await ord.getInscriptionChildren(
    client,
    '60bcf821240064a9c55225c4f01711b0ebbcab39aa3fafeefe4299ab158536fai0',
    2 // page parameter
  )
  console.log('Children:', children.ids)
  console.log('Has more:', children.more)
  return children
}

/**
 * Example: Get inscriptions by sat
 */
export async function exampleGetInscriptionsBySat(client: LaserEyesClient) {
  const inscriptions = await ord.getInscriptionsBySat(
    client,
    '1596764664144241',
    0 // page parameter
  )
  console.log('Sat inscriptions:', inscriptions.ids)
  return inscriptions
}

/**
 * Example: Get inscription at specific sat index
 */
export async function exampleGetInscriptionBySatIndex(client: LaserEyesClient) {
  const result = await ord.getInscriptionBySatIndex(
    client,
    '1596764664144241',
    0
  )
  console.log('Inscription ID:', result.id)
  return result
}

/**
 * Example: Get sat info by number
 */
export async function exampleGetSatByNumber(client: LaserEyesClient) {
  const sat = await ord.getSatInfo(client, '1596764664144241')
  console.log('Sat number:', sat.number)
  console.log('Sat name:', sat.name)
  console.log('Sat rarity:', sat.rarity)
  return sat
}

/**
 * Example: Get sat info by decimal
 */
export async function exampleGetSatByDecimal(client: LaserEyesClient) {
  const sat = await ord.getSatInfo(client, '481824.0')
  console.log('Sat info:', sat)
  return sat
}

/**
 * Example: Get sat info by degree
 */
export async function exampleGetSatByDegree(client: LaserEyesClient) {
  const sat = await ord.getSatInfo(client, "1°0′0″0‴")
  console.log('Sat info:', sat)
  return sat
}

/**
 * Example: Get sat info by name
 */
export async function exampleGetSatByName(client: LaserEyesClient) {
  const sat = await ord.getSatInfo(client, 'ahistorical')
  console.log('Sat info:', sat)
  return sat
}

/**
 * Example: Get sat info by percentile
 */
export async function exampleGetSatByPercentile(client: LaserEyesClient) {
  const sat = await ord.getSatInfo(client, '80%')
  console.log('Sat info:', sat)
  return sat
}

/**
 * Example: Get inscription content (base64)
 */
export async function exampleGetInscriptionContent(client: LaserEyesClient) {
  const content = await ord.getInscriptionContent(
    client,
    '640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0'
  )
  console.log('Content (base64):', content.substring(0, 100) + '...')
  return content
}

/**
 * Example: Get inscription preview HTML
 */
export async function exampleGetInscriptionPreview(client: LaserEyesClient) {
  const preview = await ord.getInscriptionPreview(
    client,
    '640e8ee134ecf886a874bbfd555b9e5beaf70cdc93ffe52cc10f009c8ee1cc59i0'
  )
  console.log('Preview HTML length:', preview.length)
  return preview
}

/**
 * Example: Get inscriptions by page index
 */
export async function exampleGetInscriptionsByPageIndex(client: LaserEyesClient) {
  const result = await ord.getInscriptionsByPage(client, '802285')
  console.log('Inscription IDs:', result.ids)
  console.log('Has more:', result.more)
  console.log('Page index:', result.page_index)
  return result
}

/**
 * Example: Find all inscription UTXOs with excess padding
 */
export async function exampleFindPaddingUTXOs(client: LaserEyesClient, address: string) {
  const paddingUTXOs = await ord.findInscriptionUTXOsWithPadding(client, address)
  console.log(`Found ${paddingUTXOs.length} UTXOs with excess padding`)
  
  const totalRecoverable = paddingUTXOs.reduce((sum, utxo) => sum + utxo.excessSats, 0)
  console.log(`Total recoverable: ${totalRecoverable} sats`)
  
  return paddingUTXOs
}

