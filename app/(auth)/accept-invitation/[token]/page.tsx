'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Invitation {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  company_id: string
  expires_at: string
  accepted_at: string | null
  departments: Array<{
    id: string
    name: string
  }>
}

export default function AcceptInvitationPage() {
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (token) {
      fetchInvitation()
    }
  }, [token])

  const fetchInvitation = async () => {
    try {
      // Hent invitasjon med token
      const { data: invitationData, error: invitationError } = await supabase
        .from('invitations')
        .select(`
          id,
          email,
          full_name,
          role,
          company_id,
          expires_at,
          accepted_at,
          invitation_departments (
            departments (
              id,
              name
            )
          )
        `)
        .eq('token', token)
        .single()

      if (invitationError) throw invitationError

      if (!invitationData) {
        toast.error('Invitasjon ikke funnet')
        router.push('/login')
        return
      }

      // Sjekk om invitasjonen er utløpt
      if (new Date(invitationData.expires_at) < new Date()) {
        toast.error('Invitasjonen har utløpt. Kontakt administrator for en ny invitasjon.')
        router.push('/login')
        return
      }

      // Sjekk om invitasjonen allerede er akseptert
      if (invitationData.accepted_at) {
        toast.info('Denne invitasjonen er allerede akseptert. Du kan logge inn med din konto.')
        router.push('/login')
        return
      }

      // Formater avdelinger
      const departments = (invitationData.invitation_departments || [])
        .map((id: any) => id.departments)
        .filter((d: any) => d !== null)

      setInvitation({
        id: invitationData.id,
        email: invitationData.email,
        full_name: invitationData.full_name,
        role: invitationData.role,
        company_id: invitationData.company_id,
        expires_at: invitationData.expires_at,
        accepted_at: invitationData.accepted_at,
        departments: departments,
      })
    } catch (error: any) {
      console.error('Error fetching invitation:', error)
      toast.error('Kunne ikke hente invitasjon: ' + error.message)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invitation) return

    // Validering
    if (formData.password.length < 6) {
      toast.error('Passord må være minst 6 tegn')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passordene må være like')
      return
    }

    setSubmitting(true)

    try {
      // Opprett bruker i Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          data: {
            full_name: invitation.full_name,
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Kunne ikke opprette bruker')

      // Opprett profil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: invitation.email,
          full_name: invitation.full_name,
          role: invitation.role,
          company_id: invitation.company_id,
        }])

      if (profileError) throw profileError

      // Legg til avdelinger
      if (invitation.departments.length > 0) {
        const deptInserts = invitation.departments.map(dept => ({
          user_id: authData.user.id,
          department_id: dept.id,
        }))

        const { error: deptError } = await supabase
          .from('user_departments')
          .insert(deptInserts)

        if (deptError) throw deptError
      }

      // Marker invitasjon som akseptert
      const { error: acceptError } = await supabase
        .from('invitations')
        .update({
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)

      if (acceptError) throw acceptError

      toast.success('Konto opprettet! Du kan nå logge inn.')
      router.push('/login')
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      toast.error('Kunne ikke opprette konto: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Henter invitasjon...</p>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Velkommen, {invitation.full_name}!
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Du har blitt invitert til å bli med. Opprett din konto for å fortsette.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">E-post:</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">{invitation.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Rolle:</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {invitation.role === 'admin' ? 'Administrator' : 'Bruker'}
              </p>
            </div>
            {invitation.departments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Avdelinger:</p>
                <ul className="text-sm text-gray-900 dark:text-gray-100 list-disc list-inside">
                  {invitation.departments.map(dept => (
                    <li key={dept.id}>{dept.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Passord"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
              placeholder="Minst 6 tegn"
              helper="Passordet må være minst 6 tegn langt"
            />

            <Input
              label="Bekreft passord"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              required
              placeholder="Skriv passordet igjen"
            />

            <div className="flex space-x-3 pt-4">
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Oppretter konto...' : 'Opprett konto'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Allerede har en konto? Logg inn
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

