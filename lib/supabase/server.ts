import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createServerSupabaseClient = () => {
  const cookieStore = cookies()

  // Use hardcoded values as fallback for auth callback
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://njumqvxjaktxicxwucki.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW1xdnhqYWt0eGljeHd1Y2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NDgwNzgsImV4cCI6MjA3NzEyNDA3OH0.XAiL_r-4cXWys7UcJdMmtcnnMwq5vNGlECAIVdaUKs4'

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // In server components, we can't always set cookies
            // This is expected behavior and won't break functionality
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // In server components, we can't always remove cookies
            // This is expected behavior and won't break functionality
          }
        },
      },
    }
  )
}
