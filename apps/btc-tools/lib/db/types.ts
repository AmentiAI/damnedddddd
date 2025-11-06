// Database types for BTC Tools

export interface TransactionRecord {
  id: string
  user_address: string
  tx_id: string | null
  psbt_hex: string | null
  psbt_base64: string | null
  tool_type: ToolType
  status: TransactionStatus
  fee_rate: number | null
  broadcast_method: BroadcastMethod
  network: string
  created_at: string
  updated_at: string
  metadata: Record<string, any> | null
}

export interface InscriptionTransfer {
  id: string
  user_address: string
  inscription_ids: string[]
  recipient_addresses: string[]
  tx_id: string | null
  status: TransactionStatus
  created_at: string
  updated_at: string
}

export interface OfferRecord {
  id: string
  creator_address: string
  inscription_id: string
  offer_price: number
  psbt_hex: string
  psbt_base64: string
  status: OfferStatus
  accepted_by: string | null
  tx_id: string | null
  created_at: string
  updated_at: string
}

export interface BurnRecord {
  id: string
  user_address: string
  burn_type: BurnType
  asset_ids: string[] // inscription IDs or rune IDs
  message: string | null
  tx_id: string | null
  status: TransactionStatus
  network: string
  created_at: string
  updated_at: string
}

export interface TxBuilderRecord {
  id: string
  user_address: string
  inputs: TxInput[]
  outputs: TxOutput[]
  change_address: string | null
  change_amount: number | null
  fee_rate: number
  tx_version: number
  broadcast_method: BroadcastMethod
  psbt_hex: string | null
  psbt_base64: string | null
  tx_id: string | null
  status: TransactionStatus
  network: string
  created_at: string
  updated_at: string
}

export interface OpReturnRecord {
  id: string
  user_address: string
  data: string
  data_encoding: 'utf-8' | 'hex'
  fee_rate: number
  broadcast_method: BroadcastMethod
  tx_id: string | null
  status: TransactionStatus
  network: string
  created_at: string
  updated_at: string
}

export type ToolType = 
  | 'speed_up'
  | 'cancel'
  | 'recover_padding'
  | 'utxo_recovery'
  | 'transfer_inscriptions'
  | 'create_offer'
  | 'accept_offer'
  | 'tx_builder'
  | 'burn_runes'
  | 'burn_inscriptions'
  | 'op_return'

export type TransactionStatus = 
  | 'pending'
  | 'signed'
  | 'broadcasting'
  | 'confirmed'
  | 'failed'
  | 'cancelled'

export type OfferStatus = 
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'expired'
  | 'cancelled'

export type BroadcastMethod = 
  | 'mempool'
  | 'mara_slipstream'
  | 'manual'

export type BurnType = 
  | 'inscription'
  | 'multiple_inscriptions'
  | 'runes'

export interface TxInput {
  type: 'cardinal' | 'inscription' | 'rune'
  tx_hash: string
  tx_output_index: number
  value: number
  address: string
  inscription_id?: string
  rune_id?: string
}

export interface TxOutput {
  address: string
  amount: number
  type: 'standard' | 'op_return' | 'script'
  script?: string
  data?: string
}

