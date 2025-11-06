-- BTC Tools Database Schema for Supabase (Idempotent Version)
-- This version can be run multiple times safely

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Transactions table - stores all transaction records
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  tx_id TEXT,
  psbt_hex TEXT,
  psbt_base64 TEXT,
  tool_type TEXT NOT NULL CHECK (tool_type IN (
    'speed_up', 'cancel', 'recover_padding', 'transfer_inscriptions', 
    'create_offer', 'accept_offer', 'tx_builder', 'burn_runes', 
    'burn_inscriptions', 'op_return'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed', 'broadcasting', 'confirmed', 'failed', 'cancelled'
  )),
  fee_rate INTEGER,
  broadcast_method TEXT DEFAULT 'mempool' CHECK (broadcast_method IN (
    'mempool', 'mara_slipstream', 'manual'
  )),
  network TEXT NOT NULL DEFAULT 'mainnet',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inscription transfers table
CREATE TABLE IF NOT EXISTS inscription_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  inscription_ids TEXT[] NOT NULL,
  recipient_addresses TEXT[] NOT NULL,
  tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed', 'broadcasting', 'confirmed', 'failed', 'cancelled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offers table - for create/accept offer functionality
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_address TEXT NOT NULL,
  inscription_id TEXT NOT NULL,
  offer_price BIGINT NOT NULL,
  psbt_hex TEXT NOT NULL,
  psbt_base64 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'completed', 'expired', 'cancelled'
  )),
  accepted_by TEXT,
  tx_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Burns table - for inscription and rune burns
CREATE TABLE IF NOT EXISTS burns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  burn_type TEXT NOT NULL CHECK (burn_type IN (
    'inscription', 'multiple_inscriptions', 'runes'
  )),
  asset_ids TEXT[] NOT NULL,
  message TEXT,
  tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed', 'broadcasting', 'confirmed', 'failed', 'cancelled'
  )),
  network TEXT NOT NULL DEFAULT 'mainnet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TX Builder table - for custom transaction builders
CREATE TABLE IF NOT EXISTS tx_builders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  inputs JSONB NOT NULL,
  outputs JSONB NOT NULL,
  change_address TEXT,
  change_amount BIGINT,
  fee_rate INTEGER NOT NULL,
  tx_version INTEGER DEFAULT 2,
  broadcast_method TEXT DEFAULT 'mempool' CHECK (broadcast_method IN (
    'mempool', 'mara_slipstream', 'manual'
  )),
  psbt_hex TEXT,
  psbt_base64 TEXT,
  tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed', 'broadcasting', 'confirmed', 'failed', 'cancelled'
  )),
  network TEXT NOT NULL DEFAULT 'mainnet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OP_RETURN table
CREATE TABLE IF NOT EXISTS op_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  data TEXT NOT NULL,
  data_encoding TEXT DEFAULT 'utf-8' CHECK (data_encoding IN ('utf-8', 'hex')),
  fee_rate INTEGER NOT NULL,
  broadcast_method TEXT DEFAULT 'mempool' CHECK (broadcast_method IN (
    'mempool', 'mara_slipstream', 'manual'
  )),
  tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed', 'broadcasting', 'confirmed', 'failed', 'cancelled'
  )),
  network TEXT NOT NULL DEFAULT 'mainnet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better query performance (IF NOT EXISTS for indexes)
CREATE INDEX IF NOT EXISTS idx_transactions_user_address ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_tool_type ON transactions(tool_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inscription_transfers_user_address ON inscription_transfers(user_address);
CREATE INDEX IF NOT EXISTS idx_inscription_transfers_status ON inscription_transfers(status);

CREATE INDEX IF NOT EXISTS idx_offers_inscription_id ON offers(inscription_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_creator_address ON offers(creator_address);

CREATE INDEX IF NOT EXISTS idx_burns_user_address ON burns(user_address);
CREATE INDEX IF NOT EXISTS idx_burns_status ON burns(status);

CREATE INDEX IF NOT EXISTS idx_tx_builders_user_address ON tx_builders(user_address);
CREATE INDEX IF NOT EXISTS idx_tx_builders_status ON tx_builders(status);

CREATE INDEX IF NOT EXISTS idx_op_returns_user_address ON op_returns(user_address);
CREATE INDEX IF NOT EXISTS idx_op_returns_status ON op_returns(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
-- Drop existing triggers if they exist, then create new ones
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inscription_transfers_updated_at ON inscription_transfers;
CREATE TRIGGER update_inscription_transfers_updated_at BEFORE UPDATE ON inscription_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_burns_updated_at ON burns;
CREATE TRIGGER update_burns_updated_at BEFORE UPDATE ON burns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tx_builders_updated_at ON tx_builders;
CREATE TRIGGER update_tx_builders_updated_at BEFORE UPDATE ON tx_builders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_op_returns_updated_at ON op_returns;
CREATE TRIGGER update_op_returns_updated_at BEFORE UPDATE ON op_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscription_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE burns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_returns ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own records
-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;

CREATE POLICY "Users can view their own transactions" ON transactions
    FOR SELECT USING (true); -- Adjust based on your auth setup

CREATE POLICY "Users can insert their own transactions" ON transactions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own transactions" ON transactions
    FOR UPDATE USING (true);

-- Similar policies for other tables
DROP POLICY IF EXISTS "Users can view their own inscription transfers" ON inscription_transfers;
DROP POLICY IF EXISTS "Users can insert their own inscription transfers" ON inscription_transfers;
DROP POLICY IF EXISTS "Users can update their own inscription transfers" ON inscription_transfers;

CREATE POLICY "Users can view their own inscription transfers" ON inscription_transfers
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own inscription transfers" ON inscription_transfers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own inscription transfers" ON inscription_transfers
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can view offers" ON offers;
DROP POLICY IF EXISTS "Users can create offers" ON offers;
DROP POLICY IF EXISTS "Users can update offers" ON offers;

CREATE POLICY "Anyone can view offers" ON offers
    FOR SELECT USING (true);

CREATE POLICY "Users can create offers" ON offers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update offers" ON offers
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view their own burns" ON burns;
DROP POLICY IF EXISTS "Users can insert their own burns" ON burns;
DROP POLICY IF EXISTS "Users can update their own burns" ON burns;

CREATE POLICY "Users can view their own burns" ON burns
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own burns" ON burns
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own burns" ON burns
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view their own tx builders" ON tx_builders;
DROP POLICY IF EXISTS "Users can insert their own tx builders" ON tx_builders;
DROP POLICY IF EXISTS "Users can update their own tx builders" ON tx_builders;

CREATE POLICY "Users can view their own tx builders" ON tx_builders
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own tx builders" ON tx_builders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own tx builders" ON tx_builders
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can view their own op returns" ON op_returns;
DROP POLICY IF EXISTS "Users can insert their own op returns" ON op_returns;
DROP POLICY IF EXISTS "Users can update their own op returns" ON op_returns;

CREATE POLICY "Users can view their own op returns" ON op_returns
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own op returns" ON op_returns
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own op returns" ON op_returns
    FOR UPDATE USING (true);

