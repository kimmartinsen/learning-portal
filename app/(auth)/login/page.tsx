'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    const logout = searchParams.get('logout')
    const message = searchParams.get('message')
    const error = searchParams.get('error')
    
    // If logout parameter is set, show success message and don't check session
    if (logout === 'true') {
      toast.success('Du er nå logget ut')
      return
    }

    // Show other messages/errors
    if (message) {
      toast.info(message)
    }
    
    if (error === 'profile_access') {
      toast.error('Kunne ikke hente brukerprofil. Vennligst prøv igjen.')
    } else if (error === 'no_profile') {
      toast.error('Brukerprofil ikke funnet. Kontakt administrator.')
    }
    
    // Don't check session on initial load - only check when user tries to submit
    // This prevents showing "already logged in" message when user first visits the page
  }, [searchParams])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Always sign out any existing session first to ensure clean login
      // This prevents issues when trying to log in with a different user
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      if (existingSession) {
        // Check if the email matches the existing user
        if (existingSession.user.email?.toLowerCase() === formData.email.toLowerCase()) {
          // Same user, just redirect to dashboard
          toast.info('Du er allerede logget inn. Omdirigerer til dashboard...')
          const redirectTo = searchParams.get('redirectTo') || '/dashboard'
          window.location.href = `${redirectTo}?t=${Date.now()}&nocache=1`
          return
        } else {
          // Different user - sign out the existing user first
          console.log('Different user detected, signing out existing session first')
          await supabase.auth.signOut({ scope: 'global' })
          // Clear storage
          if (typeof window !== 'undefined') {
            localStorage.clear()
            sessionStorage.clear()
          }
          // Wait a bit for session to clear
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }

      // Now sign in with the new credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) throw error

      if (data.user) {
        toast.success('Logget inn!')
        const redirectTo = searchParams.get('redirectTo') || '/dashboard'
        
        // Clear any old cached data before redirecting
        if (typeof window !== 'undefined') {
          // Force a hard reload to ensure fresh data
          window.location.href = `${redirectTo}?t=${Date.now()}&nocache=1`
        }
      }
      
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error(error.message || 'Kunne ikke logge inn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Logg inn på kontoen din
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Velkommen tilbake til opplæringsportalen
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="E-post"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="din@bedrift.no"
        />

        <Input
          label="Passord"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="Skriv inn passord"
        />

        <Button type="submit" loading={loading} className="w-full">
          Logg inn
        </Button>
      </form>

      <div className="text-center space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Har du ikke konto ennå?{' '}
          <Link href="/signup" className="font-medium text-primary-600 hover:text-primary-500">
            Opprett bedriftskonto
          </Link>
        </p>
        <div>
          <Link href="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
            Glemt passord?
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Laster...</div>}>
      <LoginForm />
    </Suspense>
  )
}
