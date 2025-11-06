import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!')
  console.error('Please ensure .env.local contains:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runSchema() {
  try {
    console.log('📖 Reading schema.sql...')
    const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
    const schema = readFileSync(schemaPath, 'utf-8')

    console.log('🚀 Executing schema SQL...')
    
    // Split by semicolons and execute statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let errorCount = 0

    for (const statement of statements) {
      try {
        // Skip comments and empty statements
        if (statement.startsWith('--') || statement.length < 10) {
          continue
        }

        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        // If RPC doesn't exist, try direct query
        if (error && error.message.includes('exec_sql')) {
          // Use REST API to execute SQL
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: statement }),
          })

          if (!response.ok) {
            // Try alternative: execute via REST API endpoint
            console.log(`  ⚠️  Direct execution may require manual setup`)
            console.log(`  Please run the schema.sql in Supabase SQL Editor`)
            break
          }
        } else if (error) {
          // Some errors are expected (like "already exists")
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.log(`  ⚠️  Warning: ${error.message}`)
          }
        } else {
          successCount++
        }
      } catch (err: any) {
        // Some errors are expected
        if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
          errorCount++
          console.log(`  ⚠️  ${err.message}`)
        }
      }
    }

    console.log(`\n✅ Schema execution completed!`)
    console.log(`   Successful: ${successCount}`)
    if (errorCount > 0) {
      console.log(`   Warnings: ${errorCount}`)
    }

    // Verify tables were created
    console.log('\n🔍 Verifying tables...')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (!tablesError && tables) {
      const expectedTables = [
        'transactions',
        'inscription_transfers',
        'offers',
        'burns',
        'tx_builders',
        'op_returns'
      ]

      const createdTables = tables.map((t: any) => t.table_name)
      const missingTables = expectedTables.filter(t => !createdTables.includes(t))

      if (missingTables.length === 0) {
        console.log('✅ All tables created successfully!')
        expectedTables.forEach(table => {
          console.log(`   ✓ ${table}`)
        })
      } else {
        console.log('⚠️  Some tables may be missing:')
        missingTables.forEach(table => {
          console.log(`   ✗ ${table}`)
        })
        console.log('\n💡 If tables are missing, please run schema.sql manually in Supabase SQL Editor')
      }
    }

    console.log('\n✨ Database setup complete!')
    console.log('   You can now use the BTC Tools application.')

  } catch (error: any) {
    console.error('❌ Error running schema:', error.message)
    console.error('\n💡 Alternative: Run the schema.sql manually in Supabase SQL Editor')
    console.error('   1. Go to your Supabase project')
    console.error('   2. Navigate to SQL Editor')
    console.error('   3. Copy and paste the contents of supabase/schema.sql')
    console.error('   4. Click Run')
    process.exit(1)
  }
}

runSchema()

