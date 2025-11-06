import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials missing!')
  console.error('Please add to apps/btc-tools/.env.local:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co')
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here')
  console.error('Get these from: https://app.supabase.com/project/YOUR_PROJECT/settings/api')
}

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required. Please add it to apps/btc-tools/.env.local')
}

if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please add it to apps/btc-tools/.env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Export for checking configuration
export { supabaseUrl, supabaseAnonKey }

// Server-side Supabase client (uses service role key)
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

