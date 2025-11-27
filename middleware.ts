import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check if environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables not found in middleware')
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/admin', '/instructor', '/my-learning', '/programs']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Admin routes that require admin role
  const adminRoutes = ['/admin']
  const isAdminRoute = adminRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Instructor routes that require instructor role (user must be instructor for at least one course)
  const instructorRoutes = ['/instructor']
  const isInstructorRoute = instructorRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Auth routes (login, signup)
  const authRoutes = ['/login', '/signup']
  const isAuthRoute = authRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Only redirect authenticated users away from auth pages if:
  // 1. There's no error parameter
  // 2. There's no explicit "logout" or "force" parameter
  // 3. We can actually fetch their profile
  // This allows users to explicitly visit /login to log out
  if (isAuthRoute && session) {
    const hasError = request.nextUrl.searchParams.has('error')
    const isLogout = request.nextUrl.searchParams.has('logout') || request.nextUrl.searchParams.has('force')
    
    // Don't redirect if there's an error or explicit logout request
    if (!hasError && !isLogout) {
      // Verify that we can actually fetch the profile before redirecting
      // This prevents redirect loops when RLS blocks profile access
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single()
      
      // Only redirect if profile can be fetched successfully
      if (profile && !profileError) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // If profile can't be fetched, don't redirect - let them stay on login
      // The layout will handle signing them out and showing the error
    }
  }

  // Redirect to login if trying to access protected route without session
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Check admin role for admin routes
  if (isAdminRoute && session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', session.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      // User is not admin, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Check instructor role for instructor routes
  if (isInstructorRoute && session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Check if user is instructor for any course
    const { count } = await supabase
      .from('training_programs')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', profile.id)
      .eq('company_id', profile.company_id)

    if ((count || 0) === 0) {
      // User is not instructor for any course, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
