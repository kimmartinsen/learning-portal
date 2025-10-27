'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    const message = searchParams.get('message')
    if (message) {
      toast.info(message)
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) throw error

      if (data.user) {
        toast.success('Logget inn!')
        const redirectTo = searchParams.get('redirectTo') || '/dashboard'
        router.push(redirectTo)
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
        <h2 className="text-2xl font-bold text-gray-900">
          Logg inn på kontoen din
        </h2>
        <p className="mt-2 text-sm text-gray-600">
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
        <p className="text-sm text-gray-600">
          Har du ikke konto ennå?{' '}
          <Link href="/signup" className="font-medium text-primary-600 hover:text-primary-500">
            Opprett bedriftskonto
          </Link>
        </p>
        <div>
          <Link href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-500">
            Glemt passord?
          </Link>
        </div>
      </div>
    </div>
  )
}
