/**
 * Run Database Schema Script
 * 
 * This script will execute the SQL schema using Supabase REST API
 * Run with: node scripts/run-schema.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found! Please create it with your Supabase credentials.')
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env = {}
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  })

  return env
}

async function runSchema() {
  try {
    console.log('🚀 BTC Tools Database Setup\n')

    // Load environment
    console.log('📖 Loading environment variables...')
    const env = loadEnv()
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables:\n  NEXT_PUBLIC_SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY')
    }

    console.log('✅ Environment loaded')
    console.log(`   URL: ${supabaseUrl.substring(0, 40)}...\n`)

    // Create client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Read schema
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`)
    }

    console.log('📖 Reading schema.sql...')
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    console.log('✅ Schema loaded\n')

    console.log('⚠️  Supabase JS client cannot execute arbitrary SQL directly.')
    console.log('   The SQL must be run through Supabase SQL Editor or REST API.\n')
    console.log('📋 Manual Setup Instructions:\n')
    console.log('   1. Open your Supabase project dashboard')
    console.log('   2. Click on "SQL Editor" in the left sidebar')
    console.log('   3. Click "New Query" button')
    console.log('   4. Copy the entire contents of: supabase/schema.sql')
    console.log('   5. Paste into the SQL Editor')
    console.log('   6. Click "Run" button (or press Ctrl+Enter)')
    console.log('   7. Wait for "Success" message\n')
    console.log('💡 Alternative: Use Supabase CLI')
    console.log('   supabase db push --db-url "your-connection-string"\n')

    // Test connection
    console.log('🔍 Testing Supabase connection...')
    try {
      // Try a simple query to verify connection
      const { data, error } = await supabase.from('transactions').select('count').limit(0)
      if (error && error.code === '42P01') {
        // Table doesn't exist - that's expected!
        console.log('✅ Connection successful (table will be created by schema)\n')
      } else if (error) {
        console.log(`⚠️  Connection test: ${error.message}\n`)
      } else {
        console.log('✅ Connection successful\n')
      }
    } catch (err) {
      console.log(`⚠️  Connection test: ${err.message}\n`)
    }

    console.log('✨ Setup instructions complete!')
    console.log('   After running the schema, your database will be ready.\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('\n💡 Please ensure:')
    console.error('   1. .env.local exists in apps/btc-tools/')
    console.error('   2. .env.local contains NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    console.error('   3. Run the schema.sql manually in Supabase SQL Editor')
    process.exit(1)
  }
}

runSchema()

