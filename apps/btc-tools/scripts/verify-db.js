/**
 * Verify Database Setup
 * 
 * Checks if all required tables exist in Supabase
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local file not found!')
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

async function verifyDatabase() {
  try {
    console.log('🔍 Verifying Database Setup\n')

    const env = loadEnv()
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials in .env.local')
    }

    console.log('✅ Environment variables loaded\n')

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const expectedTables = [
      'transactions',
      'inscription_transfers',
      'offers',
      'burns',
      'tx_builders',
      'op_returns'
    ]

    console.log('📊 Checking tables...\n')

    const results = {}

    for (const table of expectedTables) {
      try {
        // Try to select from the table (will fail if table doesn't exist)
        const { error } = await supabase.from(table).select('count').limit(0)
        
        if (error && error.code === '42P01') {
          results[table] = { exists: false, error: 'Table does not exist' }
        } else if (error) {
          results[table] = { exists: false, error: error.message }
        } else {
          results[table] = { exists: true }
        }
      } catch (err) {
        results[table] = { exists: false, error: err.message }
      }
    }

    // Display results
    let allExist = true
    for (const [table, result] of Object.entries(results)) {
      if (result.exists) {
        console.log(`✅ ${table}`)
      } else {
        console.log(`❌ ${table} - ${result.error}`)
        allExist = false
      }
    }

    console.log()

    if (allExist) {
      console.log('✨ All tables exist! Database is ready.')
      console.log('   You can now start using the BTC Tools application.\n')
    } else {
      console.log('⚠️  Some tables are missing.')
      console.log('   Please run the schema.sql in Supabase SQL Editor.\n')
      console.log('   Steps:')
      console.log('   1. Open Supabase Dashboard → SQL Editor')
      console.log('   2. Copy contents of apps/btc-tools/supabase/schema.sql')
      console.log('   3. Paste and Run\n')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

verifyDatabase()

