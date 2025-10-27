import { createBrowserClient } from '@supabase/ssr'

// Use hardcoded values as fallback for auth callback
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://njumqvxjaktxicxwucki.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW1xdnhqYWt0eGljeHd1Y2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NDgwNzgsImV4cCI6MjA3NzEyNDA3OH0.XAiL_r-4cXWys7UcJdMmtcnnMwq5vNGlECAIVdaUKs4'

export const supabase = createBrowserClient(supabaseUrl, supabaseKey)
