/**
 * Display Database Schema for Manual Execution
 * 
 * This script reads the schema.sql and displays it with instructions
 */

const fs = require('fs')
const path = require('path')

try {
  console.log('📋 BTC Tools Database Schema\n')
  console.log('=' .repeat(60))
  console.log('Copy the SQL below and run it in Supabase SQL Editor\n')

  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql')
  
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema file not found:', schemaPath)
    process.exit(1)
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  
  console.log(schema)
  console.log('\n' + '='.repeat(60))
  console.log('\n✅ Instructions:')
  console.log('   1. Copy the SQL above')
  console.log('   2. Go to your Supabase project dashboard')
  console.log('   3. Click "SQL Editor" → "New Query"')
  console.log('   4. Paste the SQL and click "Run"')
  console.log('   5. Verify tables in "Table Editor"\n')

} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

