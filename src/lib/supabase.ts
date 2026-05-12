import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Fallback to a valid-looking URL if the environment variable is missing or using the placeholder
// to prevent the Supabase client from throwing an error during initialization.
const url = isValidUrl(supabaseUrl) && supabaseUrl !== 'your-supabase-url' 
  ? supabaseUrl 
  : 'https://placeholder.supabase.co'
const key = supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-key'
  ? supabaseAnonKey
  : 'placeholder-key'

export const supabase = createClient(url, key)
