import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = cookies()
  
  // Get environment variables (required, no fallback for security)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables')
    return NextResponse.redirect(`${origin}/login?message=Configuration error`)
  }
  
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

  // Handle invite/recovery token (from email link)
  if (token_hash && type) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      })
      
      if (!error) {
        // For invite or recovery, redirect to set-password page
        if (type === 'invite' || type === 'recovery' || type === 'magiclink') {
          return NextResponse.redirect(`${origin}/set-password`)
        }
        return NextResponse.redirect(`${origin}${next}`)
      }
      console.error('OTP verification error:', error)
    } catch (error) {
      console.error('Token verification error:', error)
    }
    return NextResponse.redirect(`${origin}/login?message=Ugyldig eller utløpt lenke`)
  }

  // Handle code exchange (OAuth or email confirmation)
  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error && data.session) {
        // Check if this is a new user who needs to set password
        // (invited users have email_confirmed_at but might not have logged in before)
        const user = data.session.user
        
        // If user came from an invite and this is their first session, redirect to set password
        // We can check user_metadata or created_at vs last_sign_in_at
        if (user.user_metadata?.needs_password_set) {
          return NextResponse.redirect(`${origin}/set-password`)
        }
        
        return NextResponse.redirect(`${origin}${next}`)
      }
      if (error) {
        console.error('Code exchange error:', error)
      }
    } catch (error) {
      console.error('Auth callback error:', error)
    }
  }

  // Return the user to login with success message
  return NextResponse.redirect(`${origin}/login?message=Email confirmed! Please log in.`)
}
