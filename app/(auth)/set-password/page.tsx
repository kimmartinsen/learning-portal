'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { KeyRound, CheckCircle } from 'lucide-react'

export default function SetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Check for hash fragment tokens (Supabase invite/recovery flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        // Also check query parameters (alternative flow)
        const urlParams = new URLSearchParams(window.location.search)
        const tokenHash = urlParams.get('token_hash')
        const type = urlParams.get('type')

        if (accessToken && refreshToken) {
          // Set the session from hash tokens
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            setError('Kunne ikke verifisere invitasjonen')
            setChecking(false)
            return
          }

          if (data.session?.user) {
            setUserEmail(data.session.user.email || null)
            setChecking(false)
            window.history.replaceState({}, document.title, window.location.pathname)
            return
          }
        } else if (tokenHash && type) {
          // Verify OTP token
          const { data, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          })

          if (otpError) {
            console.error('OTP error:', otpError)
            setError('Invitasjonslenken er ugyldig eller har utløpt')
            setChecking(false)
            return
          }

          if (data.session?.user) {
            setUserEmail(data.session.user.email || null)
            setChecking(false)
            window.history.replaceState({}, document.title, window.location.pathname)
            return
          }
        }

        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUserEmail(session.user.email || null)
          setChecking(false)
          return
        }

        // Listen for auth state changes (in case Supabase handles it automatically)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('Auth event:', event)
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') && session?.user) {
            setUserEmail(session.user.email || null)
            setChecking(false)
          }
        })

        // Give it time to process
        setTimeout(() => {
          setChecking(false)
        }, 3000)

        return () => subscription.unsubscribe()
      } catch (err) {
        console.error('Auth handling error:', err)
        setError('En feil oppstod ved verifisering')
        setChecking(false)
      }
    }

    handleAuth()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Passordet må være minst 6 tegn')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passordene er ikke like')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast.success('Passord satt! Du blir nå sendt til dashboardet.')
      
      // Wait a moment then redirect
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke sette passord')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Verifiserer invitasjon...</p>
      </div>
    )
  }

  if (!userEmail || error) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <KeyRound className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Ugyldig eller utløpt lenke
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {error || 'Invitasjonslenken er ugyldig eller har utløpt. Kontakt din administrator for å få en ny invitasjon.'}
        </p>
        <Button 
          onClick={() => router.push('/login')} 
          className="mt-4 w-full"
          variant="secondary"
        >
          Gå til innlogging
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-5">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Velkommen!
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Sett et passord for kontoen din
        </p>
        <p className="mt-0.5 text-sm text-primary-600 dark:text-primary-400 font-medium">
          {userEmail}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nytt passord"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Minst 6 tegn"
          autoFocus
        />

        <Input
          label="Bekreft passord"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Skriv passordet på nytt"
        />

        <Button
          type="submit"
          className="w-full mt-4"
          disabled={loading}
        >
          {loading ? 'Setter passord...' : 'Sett passord og fortsett'}
        </Button>
      </form>
    </div>
  )
}
