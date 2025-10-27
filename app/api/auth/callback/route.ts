import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      const cookieStore = cookies()
      
      // Use hardcoded values as fallback
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://njumqvxjaktxicxwucki.supabase.co'
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW1xdnhqYWt0eGljeHd1Y2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NDgwNzgsImV4cCI6MjA3NzEyNDA3OH0.XAiL_r-4cXWys7UcJdMmtcnnMwq5vNGlECAIVdaUKs4'
      
      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: any) {
              cookieStore.set({ name, value, ...options })
            },
            remove(name: string, options: any) {
              cookieStore.set({ name, value: '', ...options })
            },
          },
        }
      )

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (error) {
      console.error('Auth callback error:', error)
    }
  }

  // Return the user to login with success message
  return NextResponse.redirect(`${origin}/login?message=Email confirmed! Please log in.`)
}
