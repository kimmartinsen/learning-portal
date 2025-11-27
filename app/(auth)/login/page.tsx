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
    
    // If logout parameter is set, don't check session (user just logged out)
    if (logout === 'true') {
      toast.success('Du er nå logget ut')
      return
    }

    // Check if user is already logged in (only if not logging out)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // User is already logged in, offer to go to dashboard or log out
        toast.info('Du er allerede logget inn. Gå til dashboard eller logg ut først.', {
          duration: 5000,
        })
      }
    }
    checkSession()

    const message = searchParams.get('message')
    if (message) {
      toast.info(message)
    }
    
    const error = searchParams.get('error')
    if (error === 'profile_access') {
      toast.error('Kunne ikke hente brukerprofil. Vennligst prøv igjen.')
    } else if (error === 'no_profile') {
      toast.error('Brukerprofil ikke funnet. Kontakt administrator.')
    }
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
      // Check if user is already logged in
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      if (existingSession) {
        // User is already logged in, redirect to dashboard
        toast.info('Du er allerede logget inn. Omdirigerer til dashboard...')
        const redirectTo = searchParams.get('redirectTo') || '/dashboard'
        window.location.href = redirectTo
        return
      }

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
          // Clear React Query cache if it exists
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
