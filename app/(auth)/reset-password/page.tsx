'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('Ugyldig eller utløpt lenke. Vennligst be om en ny tilbakestillingslenke.')
      }
    }

    // Listen for auth state changes (when user clicks the reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link, they can now set a new password
        setError(null)
      }
    })

    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passordene matcher ikke')
      return
    }

    if (password.length < 8) {
      toast.error('Passord må være minst 8 tegn')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      toast.success('Passord oppdatert!')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (error: any) {
      console.error('Reset password error:', error)
      toast.error(error.message || 'Kunne ikke oppdatere passord. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Passord oppdatert!
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Ditt passord er nå endret. Du blir sendt til innloggingssiden...
          </p>
        </div>

        <Link href="/login">
          <Button className="w-full">
            Gå til innlogging
          </Button>
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Ugyldig lenke
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {error}
          </p>
        </div>

        <Link href="/forgot-password">
          <Button className="w-full">
            Be om ny lenke
          </Button>
        </Link>
        
        <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 inline-flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Tilbake til innlogging
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Opprett nytt passord
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Skriv inn ditt nye passord nedenfor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Lock className="absolute left-3 top-9 h-4 w-4 text-gray-400" />
          <Input
            label="Nytt passord"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minst 8 tegn"
            className="pl-10 pr-10"
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-9 h-4 w-4 text-gray-400" />
          <Input
            label="Bekreft passord"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Gjenta passordet"
            className="pl-10"
            minLength={8}
          />
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Passord må være minst 8 tegn.
        </p>

        <Button type="submit" loading={loading} className="w-full">
          Oppdater passord
        </Button>
      </form>

      <div className="text-center">
        <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 inline-flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Tilbake til innlogging
        </Link>
      </div>
    </div>
  )
}

