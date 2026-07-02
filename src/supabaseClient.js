import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // Surfaced in the UI too, but this makes misconfig obvious in console.
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url || '', anon || '')
export const hasConfig = Boolean(url && anon)
