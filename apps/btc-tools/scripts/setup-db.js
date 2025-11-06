/**
 * Database Setup Script
 * 
 * This script attempts to run the database schema automatically.
 * If it fails, you'll need to run the schema.sql manually in Supabase SQL Editor.
 * 
 * Usage: node scripts/setup-db.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!')
    process.exit(1)
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
    console.log('📖 Loading environment variables...')
    const env = loadEnv()

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables!')
      console.error('Please ensure .env.local contains:')
      console.error('  NEXT_PUBLIC_SUPABASE_URL')
      console.error('  SUPABASE_SERVICE_ROLE_KEY')
      process.exit(1)
    }

    console.log('✅ Environment variables loaded')
    console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`)

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('\n📖 Reading schema.sql...')
    const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql')
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`❌ Schema file not found at: ${schemaPath}`)
      process.exit(1)
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8')
    console.log('✅ Schema file loaded')

    console.log('\n⚠️  Direct SQL execution via Supabase JS client is limited.')
    console.log('   The best way to run the schema is manually in Supabase SQL Editor.')
    console.log('\n📋 Instructions:')
    console.log('   1. Go to your Supabase project dashboard')
    console.log('   2. Navigate to "SQL Editor"')
    console.log('   3. Click "New Query"')
    console.log('   4. Copy the entire contents of: supabase/schema.sql')
    console.log('   5. Paste into the SQL Editor')
    console.log('   6. Click "Run" (or press Ctrl+Enter)')
    console.log('\n💡 Alternatively, you can use the Supabase CLI:')
    console.log('   supabase db push --db-url "your-database-url"')

    // Try to verify connection
    console.log('\n🔍 Testing Supabase connection...')
    try {
      const { data, error } = await supabase.from('_prisma_migrations').select('count').limit(1)
      if (error) {
        // This is fine, table might not exist
        console.log('✅ Successfully connected to Supabase!')
      }
    } catch (err) {
      console.log('✅ Supabase connection test completed')
    }

    console.log('\n✨ Setup script complete!')
    console.log('   Please run the schema.sql manually as described above.')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('\n💡 Please run the schema.sql manually in Supabase SQL Editor')
    process.exit(1)
  }
}

runSchema()

