'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

function ChangePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFirstTime = searchParams.get('firstTime') === 'true'
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    // Sjekk om brukeren er logget inn
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      }
    }
    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validering
    if (formData.newPassword.length < 6) {
      toast.error('Nytt passord må være minst 6 tegn')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passordene må være like')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Ikke innlogget')
        router.push('/login')
        return
      }

      // Hvis det er første gang, sjekk at currentPassword er riktig
      if (isFirstTime) {
        // Verifiser at currentPassword er riktig ved å prøve å logge inn
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: formData.currentPassword,
        })

        if (verifyError) {
          toast.error('Nåværende passord er feil')
          setLoading(false)
          return
        }
      }

      // Oppdater passord
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      })

      if (updateError) throw updateError

      // Hvis det er første gang, fjern must_change_password flag
      if (isFirstTime) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id)

        if (profileError) throw profileError
      }

      toast.success('Passord endret!')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast.error('Kunne ikke endre passord: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isFirstTime ? 'Velkommen! Sett ditt passord' : 'Endre passord'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {isFirstTime 
              ? 'Du må endre passordet ditt før du kan fortsette.'
              : 'Oppdater passordet ditt for å sikre kontoen din.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isFirstTime && (
              <Input
                label="Nåværende passord (midlertidig)"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                required
                placeholder="Skriv inn midlertidig passord"
                helper="Dette er det midlertidige passordet du fikk ved opprettelse"
              />
            )}

            <Input
              label="Nytt passord"
              type="password"
              value={formData.newPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
              required
              placeholder="Minst 6 tegn"
              helper="Passordet må være minst 6 tegn langt"
            />

            <Input
              label="Bekreft nytt passord"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              required
              placeholder="Skriv passordet igjen"
            />

            <div className="flex space-x-3 pt-4">
              <Button type="submit" className="flex-1" loading={loading}>
                {isFirstTime ? 'Sett passord' : 'Endre passord'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Laster...</div>}>
      <ChangePasswordForm />
    </Suspense>
  )
}

