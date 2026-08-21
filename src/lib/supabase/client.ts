import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-beacnoxukkoellhecofm-auth-token',
  },
  global: {
    fetch: (url, init) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const merged = { ...init, signal: controller.signal }
      return fetch(url, merged).finally(() => clearTimeout(timeout))
    },
  },
})
