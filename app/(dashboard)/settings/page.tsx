'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { User, Mail, Lock, Building2, Save, Eye, EyeOff } from 'lucide-react'

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  company_id: string
}

interface Company {
  id: string
  name: string
  org_number?: string | null
  address?: string | null
  phone?: string | null
  contact_email?: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  
  // Profile form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  
  // Company form (admin only)
  const [companyName, setCompanyName] = useState('')
  const [orgNumber, setOrgNumber] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, company_id')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError

      setProfile(profileData)
      setFullName(profileData.full_name || '')
      setEmail(profileData.email || session.user.email || '')

      // Fetch company if admin
      if (profileData.role === 'admin') {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profileData.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData as Company)
          setCompanyName(companyData.name || '')
          setOrgNumber((companyData as any).org_number || '')
          setCompanyAddress((companyData as any).address || '')
          setCompanyPhone((companyData as any).phone || '')
          setCompanyEmail((companyData as any).contact_email || '')
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    try {
      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          email: email.trim()
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      // Update email in auth if changed
      const { data: { session } } = await supabase.auth.getSession()
      if (session && email.trim() !== session.user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: email.trim()
        })
        
        if (authError) {
          toast.error('Kunne ikke oppdatere e-post i autentisering: ' + authError.message)
        } else {
          toast.info('En bekreftelseslenke er sendt til din nye e-postadresse')
        }
      }

      toast.success('Profil oppdatert!')
      router.refresh()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error('Kunne ikke oppdatere profil: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('Passordene matcher ikke')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Passord må være minst 8 tegn')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      toast.success('Passord oppdatert!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Error updating password:', error)
      toast.error('Kunne ikke oppdatere passord: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return

    setSaving(true)
    try {
      // Build update object with only the fields we want to update
      const updateData: Record<string, any> = {
        name: companyName.trim()
      }
      
      // Add optional fields if columns exist in DB
      if (orgNumber.trim()) updateData.org_number = orgNumber.trim()
      if (companyAddress.trim()) updateData.address = companyAddress.trim()
      if (companyPhone.trim()) updateData.phone = companyPhone.trim()
      if (companyEmail.trim()) updateData.contact_email = companyEmail.trim()

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id)

      if (error) throw error

      toast.success('Firmainformasjon oppdatert!')
      router.refresh()
    } catch (error: any) {
      console.error('Error updating company:', error)
      toast.error('Kunne ikke oppdatere firma: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Laster...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Innstillinger</h1>
        <p className="text-gray-600 dark:text-gray-300">Administrer din profil og kontoinnstillinger</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profilinformasjon</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fullt navn
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ola Nordmann"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                E-postadresse
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ola@example.com"
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ved endring av e-post vil du motta en bekreftelseslenke
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Lagrer...' : 'Lagre endringer'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Endre passord</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nytt passord
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bekreft nytt passord
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  minLength={8}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Passord må være minst 8 tegn
              </p>
            </div>

            <Button type="submit" disabled={saving || !newPassword || !confirmPassword}>
              <Lock className="h-4 w-4 mr-2" />
              {saving ? 'Oppdaterer...' : 'Oppdater passord'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Company Settings (Admin only) */}
      {profile?.role === 'admin' && company && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Firmainformasjon</h2>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Firmanavn *
                </label>
                <Input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Bedrift AS"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organisasjonsnummer
                </label>
                <Input
                  type="text"
                  value={orgNumber}
                  onChange={(e) => setOrgNumber(e.target.value)}
                  placeholder="123 456 789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Adresse
                </label>
                <Input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Gateveien 1, 0000 Oslo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefon
                  </label>
                  <Input
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+47 12 34 56 78"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kontakt e-post
                  </label>
                  <Input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="kontakt@bedrift.no"
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Lagrer...' : 'Lagre firmainformasjon'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

