# Quick Database Setup

Since Supabase JS client cannot execute arbitrary SQL directly, you need to run the schema manually. Here's how:

## Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Schema**
   - Open the file: `apps/btc-tools/supabase/schema.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)
   - Wait for "Success" message

4. **Verify Tables**
   - Go to "Table Editor" in left sidebar
   - You should see these tables:
     - ✅ transactions
     - ✅ inscription_transfers
     - ✅ offers
     - ✅ burns
     - ✅ tx_builders
     - ✅ op_returns

## Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
cd apps/btc-tools
supabase db push --db-url "your-database-connection-string"
```

## What the Schema Creates

- ✅ 6 database tables for all BTC tools
- ✅ Indexes for optimal performance
- ✅ Row Level Security (RLS) policies
- ✅ Automatic timestamp triggers
- ✅ Foreign keys and constraints

## After Setup

Once the schema is run, your `.env.local` file should have:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Then you can start the dev server:
```bash
cd apps/btc-tools
pnpm dev
```

All tools will automatically save to the database! 🎉

