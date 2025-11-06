import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase'
import type {
  TransactionRecord,
  InscriptionTransfer,
  OfferRecord,
  BurnRecord,
  TxBuilderRecord,
  OpReturnRecord,
  TransactionStatus,
  OfferStatus,
} from './types'

// Transaction Records
export async function createTransactionRecord(data: Omit<TransactionRecord, 'id' | 'created_at' | 'updated_at'>) {
  // Gracefully handle missing Supabase configuration
  if (!supabaseUrl || supabaseAnonKey === 'YOUR_ANON_KEY_HERE' || !supabaseAnonKey) {
    console.warn('⚠️ Supabase not configured - skipping database save. Transaction still works!')
    return null
  }
  const { data: record, error } = await supabase
    .from('transactions')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return record as TransactionRecord
}

export async function getTransactionRecord(id: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as TransactionRecord
}

export async function getUserTransactions(userAddress: string, toolType?: string) {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_address', userAddress)
    .order('created_at', { ascending: false })
  
  if (toolType) {
    query = query.eq('tool_type', toolType)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data as TransactionRecord[]
}

export async function updateTransactionStatus(id: string, status: TransactionStatus, txId?: string) {
  const updateData: any = { status, updated_at: new Date().toISOString() }
  if (txId) updateData.tx_id = txId
  
  const { data, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as TransactionRecord
}

// Inscription Transfers
export async function createInscriptionTransfer(data: Omit<InscriptionTransfer, 'id' | 'created_at' | 'updated_at'>) {
  // Gracefully handle missing Supabase configuration
  if (!supabaseUrl || supabaseAnonKey === 'YOUR_ANON_KEY_HERE' || !supabaseAnonKey) {
    console.warn('⚠️ Supabase not configured - skipping database save. Transaction still works!')
    return null
  }
  const { data: record, error } = await supabase
    .from('inscription_transfers')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return record as InscriptionTransfer
}

export async function getInscriptionTransfer(id: string) {
  const { data, error } = await supabase
    .from('inscription_transfers')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as InscriptionTransfer
}

// Offers
export async function createOffer(data: Omit<OfferRecord, 'id' | 'created_at' | 'updated_at'>) {
  // Gracefully handle missing Supabase configuration
  if (!supabaseUrl || supabaseAnonKey === 'YOUR_ANON_KEY_HERE' || !supabaseAnonKey) {
    console.warn('⚠️ Supabase not configured - skipping database save. Transaction still works!')
    return null
  }
  const { data: record, error } = await supabase
    .from('offers')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return record as OfferRecord
}

export async function getOffer(id: string) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as OfferRecord
}

export async function getOffersByInscription(inscriptionId: string) {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('inscription_id', inscriptionId)
    .eq('status', 'pending')
    .order('offer_price', { ascending: false })
  
  if (error) throw error
  return data as OfferRecord[]
}

export async function acceptOffer(id: string, acceptedBy: string, txId: string) {
  const { data, error } = await supabase
    .from('offers')
    .update({
      status: 'accepted',
      accepted_by: acceptedBy,
      tx_id: txId,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as OfferRecord
}

export async function updateOffer(
  id: string,
  data: Partial<Pick<OfferRecord, 'status' | 'accepted_by' | 'tx_id'>>
) {
  const updateData: any = {
    ...data,
    updated_at: new Date().toISOString()
  }
  
  const { data: record, error } = await supabase
    .from('offers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return record as OfferRecord
}

// Burns
export async function createBurnRecord(data: Omit<BurnRecord, 'id' | 'created_at' | 'updated_at'>) {
  // Gracefully handle missing Supabase configuration
  if (!supabaseUrl || supabaseAnonKey === 'YOUR_ANON_KEY_HERE' || !supabaseAnonKey) {
    console.warn('⚠️ Supabase not configured - skipping database save. Transaction still works!')
    return null
  }
  const { data: record, error } = await supabase
    .from('burns')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return record as BurnRecord
}

export async function getBurnRecord(id: string) {
  const { data, error } = await supabase
    .from('burns')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as BurnRecord
}

// TX Builder
export async function createTxBuilderRecord(data: Omit<TxBuilderRecord, 'id' | 'created_at' | 'updated_at'>) {
  // Gracefully handle missing Supabase configuration
  if (!supabaseUrl || supabaseAnonKey === 'YOUR_ANON_KEY_HERE' || !supabaseAnonKey) {
    console.warn('⚠️ Supabase not configured - skipping database save. Transaction still works!')
    return null
  }
  const { data: record, error } = await supabase
    .from('tx_builders')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return record as TxBuilderRecord
}

export async function getTxBuilderRecord(id: string) {
  const { data, error } = await supabase
    .from('tx_builders')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as TxBuilderRecord
}

export async function getUserTxBuilders(userAddress: string) {
  const { data, error } = await supabase
    .from('tx_builders')
    .select('*')
    .eq('user_address', userAddress)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as TxBuilderRecord[]
}

// OP_RETURN
export async function createOpReturnRecord(data: Omit<OpReturnRecord, 'id' | 'created_at' | 'updated_at'>) {
  // Gracefully handle missing Supabase configuration
  if (!supabaseUrl || supabaseAnonKey === 'YOUR_ANON_KEY_HERE' || !supabaseAnonKey) {
    console.warn('⚠️ Supabase not configured - skipping database save. Transaction still works!')
    return null
  }
  const { data: record, error } = await supabase
    .from('op_returns')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return record as OpReturnRecord
}

export async function getOpReturnRecord(id: string) {
  const { data, error } = await supabase
    .from('op_returns')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as OpReturnRecord
}

// Convenience aliases for cleaner imports
export const createTransaction = createTransactionRecord
export const createOpReturn = createOpReturnRecord
export const createBurn = createBurnRecord

