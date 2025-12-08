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

  useEffect(() => {
    // Check if user is authenticated via invite link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setChecking(false)
      } else {
        // Listen for auth state changes (in case the token is being processed)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            setUserEmail(session.user.email || null)
            setChecking(false)
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            setUserEmail(session.user.email || null)
            setChecking(false)
          }
        })

        // Give it a moment to process the invite token
        setTimeout(() => {
          setChecking(false)
        }, 2000)

        return () => subscription.unsubscribe()
      }
    }

    checkSession()
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifiserer invitasjon...</p>
        </div>
      </div>
    )
  }

  if (!userEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <KeyRound className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Ugyldig eller utløpt lenke
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Invitasjonslenken er ugyldig eller har utløpt. Kontakt din administrator for å få en ny invitasjon.
            </p>
            <Button 
              onClick={() => router.push('/login')} 
              className="mt-6 w-full"
              variant="secondary"
            >
              Gå til innlogging
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Velkommen!
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Sett et passord for kontoen din
            </p>
            <p className="mt-1 text-sm text-primary-600 dark:text-primary-400 font-medium">
              {userEmail}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Setter passord...' : 'Sett passord og fortsett'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

