'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      setEmailSent(true)
      toast.success('E-post sendt! Sjekk innboksen din.')
    } catch (error: any) {
      console.error('Reset password error:', error)
      toast.error(error.message || 'Kunne ikke sende e-post. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Sjekk e-posten din
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Vi har sendt en lenke til <strong>{email}</strong> for å tilbakestille passordet ditt.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Finner du ikke e-posten? Sjekk spam-mappen.
          </p>
          
          <Button
            variant="secondary"
            onClick={() => setEmailSent(false)}
            className="w-full"
          >
            Prøv en annen e-postadresse
          </Button>
          
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tilbake til innlogging
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Glemt passord?
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Skriv inn e-postadressen din, så sender vi deg en lenke for å tilbakestille passordet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-9 h-4 w-4 text-gray-400" />
          <Input
            label="E-postadresse"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@bedrift.no"
            className="pl-10"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Send tilbakestillingslenke
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

