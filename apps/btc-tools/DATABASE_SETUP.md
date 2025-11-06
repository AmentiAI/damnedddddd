# Database Setup Guide for BTC Tools

## Overview

The BTC Tools application is **fully database-driven** using Supabase (PostgreSQL). All transactions, PSBTs, offers, burns, and other operations are persisted to the database.

## Quick Setup

### 1. Create `.env.local` File

Create a `.env.local` file in `apps/btc-tools/` with your Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional: Sandshrew API
NEXT_PUBLIC_SANDSHREW_API_KEY=your_key_here
```

**Where to find these values:**
- Go to your Supabase project dashboard
- Navigate to **Settings** → **API**
- Copy the **Project URL** and **anon/public key**
- Copy the **service_role key** (keep this secret!)

### 2. Run Database Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `supabase/schema.sql`
5. Click **Run** (or press Ctrl+Enter)

This will create:
- ✅ All database tables
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Automatic timestamp triggers

### 3. Verify Setup

After running the schema, verify the tables were created:

1. Go to **Table Editor** in Supabase
2. You should see these tables:
   - `transactions`
   - `inscription_transfers`
   - `offers`
   - `burns`
   - `tx_builders`
   - `op_returns`

## Database Schema

### Tables Overview

#### `transactions`
Stores all transaction records across all tools.
- **Fields**: id, user_address, tx_id, psbt_hex, psbt_base64, tool_type, status, fee_rate, broadcast_method, network, metadata, timestamps
- **Use Cases**: Speed up, Cancel, Recover Padding

#### `inscription_transfers`
Tracks inscription transfer operations.
- **Fields**: id, user_address, inscription_ids, recipient_addresses, tx_id, status, timestamps
- **Use Cases**: Transfer Inscriptions tool

#### `offers`
Manages buy/sell offers for inscriptions.
- **Fields**: id, creator_address, inscription_id, offer_price, psbt_hex, psbt_base64, status, accepted_by, tx_id, timestamps
- **Use Cases**: Create Offer, Accept Offer

#### `burns`
Records inscription and rune burns.
- **Fields**: id, user_address, burn_type, asset_ids, message, tx_id, status, network, timestamps
- **Use Cases**: Burn Inscriptions, Burn Runes

#### `tx_builders`
Saves custom transaction builder configurations.
- **Fields**: id, user_address, inputs (JSONB), outputs (JSONB), change_address, change_amount, fee_rate, tx_version, broadcast_method, psbt_hex, psbt_base64, tx_id, status, network, timestamps
- **Use Cases**: TX Builder tool

#### `op_returns`
Stores OP_RETURN transaction records.
- **Fields**: id, user_address, data, data_encoding, fee_rate, broadcast_method, tx_id, status, network, timestamps
- **Use Cases**: OP_RETURN tool

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that allow:
- Users to view their own records
- Users to create their own records
- Users to update their own records
- Public viewing of offers (for marketplace functionality)

**Note**: Adjust RLS policies in the schema if you need different permissions.

### Environment Variables

- **Client-side** (`NEXT_PUBLIC_*`): Exposed to browser, safe for public access
- **Server-side** (`SUPABASE_SERVICE_ROLE_KEY`): Never expose to client, only use in API routes

## API Integration

### Client-Side Usage

```typescript
import { useTransactions } from '@/hooks/use-transactions'

const { createTransaction, getTransactions, updateTransactionStatus } = useTransactions()

// Create a transaction record
const record = await createTransaction({
  user_address: 'bc1q...',
  tool_type: 'speed_up',
  fee_rate: 10,
  network: 'mainnet'
})

// Get user's transactions
const transactions = await getTransactions('bc1q...', 'speed_up')

// Update status
await updateTransactionStatus(record.id, 'confirmed', 'txid...')
```

### Direct Database Queries

```typescript
import { supabase } from '@/lib/supabase'
import { createTransactionRecord } from '@/lib/db/queries'

// In server-side code (API routes)
const record = await createTransactionRecord({
  user_address: 'bc1q...',
  tool_type: 'speed_up',
  // ... other fields
})
```

## Data Flow

1. **User Action** → Tool UI component
2. **Tool Logic** → Builds PSBT/transaction
3. **API Route** → `/api/transactions` (or other endpoint)
4. **Database Query** → `lib/db/queries.ts`
5. **Supabase Client** → `lib/supabase.ts`
6. **Database** → PostgreSQL (Supabase)

## Status Workflow

All transactions follow this status flow:

```
pending → signed → broadcasting → confirmed
                           ↓
                        failed
```

- **pending**: Transaction created, PSBT not signed yet
- **signed**: PSBT signed by wallet
- **broadcasting**: Transaction submitted to network
- **confirmed**: Transaction confirmed on blockchain
- **failed**: Transaction failed or rejected
- **cancelled**: User cancelled the operation

## Troubleshooting

### "Supabase credentials not found"
- Check that `.env.local` exists in `apps/btc-tools/`
- Verify environment variable names match exactly
- Restart your dev server after adding `.env.local`

### "Table does not exist"
- Run the SQL schema in Supabase SQL Editor
- Check for any errors in the SQL execution
- Verify tables appear in Table Editor

### "Policy violation" or RLS errors
- Check RLS policies in the schema
- Verify user authentication (if using Supabase Auth)
- Adjust policies if needed for your use case

### Connection issues
- Verify Supabase project is active
- Check network connectivity
- Ensure API keys are correct

## Next Steps

Once the database is set up:

1. ✅ All tools will automatically persist data
2. ✅ Transaction history will be available
3. ✅ PSBTs will be saved for recovery
4. ✅ Status tracking will work automatically

You can now start implementing the individual tools - they're all ready to use the database!

