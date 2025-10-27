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
        .insert({
          name: formData.companyName,
          badge_system_enabled: true,
        })
        .select()
        .single()

      if (companyError) throw companyError

      // 3. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          role: 'admin',
          company_id: companyData.id,
        })

      if (profileError) throw profileError

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
        <h2 className="text-2xl font-bold text-gray-900">
          Opprett bedriftskonto
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Registrer din bedrift og bli den første administratoren
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <Button type="submit" loading={loading} className="w-full">
          Opprett bedriftskonto
        </Button>
      </form>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
            Logg inn her
          </Link>
        </p>
      </div>
    </div>
  )
}
