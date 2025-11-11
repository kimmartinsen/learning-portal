'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    orgNumber: '',
    address: '',
    postalCode: '',
    city: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passordene stemmer ikke overens')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Passord må være minst 6 tegn')
      return
    }

    // Validate organisasjonsnummer (9 digits)
    if (formData.orgNumber && !/^\d{9}$/.test(formData.orgNumber)) {
      toast.error('Organisasjonsnummer må være 9 siffer')
      return
    }

    // Validate postnummer (4 digits)
    if (formData.postalCode && !/^\d{4}$/.test(formData.postalCode)) {
      toast.error('Postnummer må være 4 siffer')
      return
    }

    setLoading(true)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            company_name: formData.companyName,
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Kunne ikke opprette bruker')

      // 2. Create company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: formData.companyName,
          org_number: formData.orgNumber || null,
          address: formData.address || null,
          postal_code: formData.postalCode || null,
          city: formData.city || null,
          badge_system_enabled: true,
        }])
        .select()
        .single()

      if (companyError) throw companyError

      // 3. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          role: 'admin',
          company_id: companyData.id,
        }])

      if (profileError) throw profileError

      // 4. Create notification preferences (in case trigger didn't work)
      const { error: notifPrefError } = await supabase
        .from('notification_preferences')
        .insert([{
          user_id: authData.user.id
        }])
      
      // Don't throw error if preferences already exist (trigger might have created it)
      if (notifPrefError && !notifPrefError.message?.includes('duplicate')) {
        console.warn('Could not create notification preferences:', notifPrefError)
      }

      toast.success('Konto opprettet! Sjekk e-posten din for bekreftelse.')
      router.push('/login?message=Sjekk e-posten din for å bekrefte kontoen')
      
    } catch (error: any) {
      console.error('Signup error:', error)
      toast.error(error.message || 'Kunne ikke opprette konto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Opprett bedriftskonto
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Registrer din bedrift og bli den første administratoren
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bedriftsinformasjon</h3>
          
          <Input
            label="Bedriftsnavn"
            name="companyName"
            type="text"
            required
            value={formData.companyName}
            onChange={handleChange}
            placeholder="Skriv inn bedriftsnavn"
          />

          <Input
            label="Organisasjonsnummer"
            name="orgNumber"
            type="text"
            required
            value={formData.orgNumber}
            onChange={handleChange}
            placeholder="9 siffer (f.eks. 123456789)"
            maxLength={9}
          />

          <Input
            label="Adresse"
            name="address"
            type="text"
            value={formData.address}
            onChange={handleChange}
            placeholder="Gate og nummer"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postnummer"
              name="postalCode"
              type="text"
              value={formData.postalCode}
              onChange={handleChange}
              placeholder="4 siffer"
              maxLength={4}
            />

            <Input
              label="Poststed"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              placeholder="By"
            />
          </div>
        </div>

        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Din informasjon</h3>
          
          <Input
            label="Fullt navn"
            name="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Skriv inn ditt fulle navn"
          />

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
          placeholder="Minst 6 tegn"
        />

        <Input
          label="Bekreft passord"
          name="confirmPassword"
          type="password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Gjenta passord"
        />
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Opprett bedriftskonto
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
            Logg inn her
          </Link>
        </p>
      </div>
    </div>
  )
}
