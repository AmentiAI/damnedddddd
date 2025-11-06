# BTC Tools - Database-Driven Bitcoin Transaction Tools

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the `apps/btc-tools` directory with the following:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Sandshrew API Key (optional)
NEXT_PUBLIC_SANDSHREW_API_KEY=your_sandshrew_api_key
```

### 2. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL schema from `supabase/schema.sql`
4. This will create all necessary tables, indexes, and RLS policies

### 3. Install Dependencies

```bash
cd apps/btc-tools
pnpm install
```

### 4. Run Development Server

```bash
pnpm dev
```

## Database Schema

The application uses Supabase (PostgreSQL) with the following tables:

- **transactions** - Stores all transaction records across all tools
- **inscription_transfers** - Tracks inscription transfer operations
- **offers** - Manages buy/sell offers for inscriptions
- **burns** - Records inscription and rune burns
- **tx_builders** - Saves custom transaction builder configurations
- **op_returns** - Stores OP_RETURN transaction records

All tables include:
- Row Level Security (RLS) enabled
- Automatic `updated_at` timestamps
- Indexes for optimal query performance

## API Routes

All tools persist data to the database via API routes:

- `/api/transactions` - CRUD for transaction records
- `/api/tx-builder` - TX Builder operations
- `/api/offers` - Offer creation and acceptance
- `/api/burns` - Burn operations
- `/api/op-return` - OP_RETURN operations

## Features

- ✅ All transaction data persisted to Supabase
- ✅ Transaction history tracking
- ✅ Status tracking (pending, signed, broadcasting, confirmed, failed)
- ✅ PSBT storage (hex and base64)
- ✅ Metadata support for custom data
- ✅ User-specific data isolation

