'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users, Mail, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateInitials } from '@/lib/utils'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  avatar_url: string | null
  created_at: string
  department_id: string | null
  departments?: {
    name: string
  } | null
}

interface Department {
  id: string
  name: string
}

interface User {
  id: string
  role: string
  company_id: string
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<User | null>(null)
  
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: 'user' as 'admin' | 'instructor' | 'user',
    departmentId: '',
    password: '',
  })

  useEffect(() => {
    fetchUserAndProfiles()
    fetchDepartments()
  }, [])

  const fetchUserAndProfiles = async () => {
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', session.user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        toast.error('Ikke autorisert')
        return
      }

      setUser(profile)

      // Fetch all profiles for the user's company
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProfiles(profilesData || [])
    } catch (error: any) {
      toast.error('Kunne ikke hente brukere: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single()

      if (!profile) return

      const { data: departmentsData, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .order('name')

      if (error) throw error
      setDepartments(departmentsData || [])
    } catch (error: any) {
      console.error('Error fetching departments:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (editingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.fullName,
            role: formData.role,
            department_id: formData.departmentId || null,
          })
          .eq('id', editingProfile.id)

        if (error) throw error
        toast.success('Bruker oppdatert!')
      } else {
        // Create new user via auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          user_metadata: {
            full_name: formData.fullName,
          }
        })

        if (authError) {
          // Fallback to client-side signup if admin method fails
          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                full_name: formData.fullName,
              }
            }
          })

          if (signupError) throw signupError
          if (!signupData.user) throw new Error('Could not create user')

          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: signupData.user.id,
              email: formData.email,
              full_name: formData.fullName,
              role: formData.role,
              company_id: user.company_id,
              department_id: formData.departmentId || null,
            }])

          if (profileError) throw profileError
        } else {
          // Create profile for admin-created user
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: authData.user.id,
              email: formData.email,
              full_name: formData.fullName,
              role: formData.role,
              company_id: user.company_id,
              department_id: formData.departmentId || null,
            }])

          if (profileError) throw profileError
        }

        toast.success('Bruker opprettet!')
      }

      setShowForm(false)
      setEditingProfile(null)
      setFormData({ email: '', fullName: '', role: 'user', departmentId: '', password: '' })
      fetchUserAndProfiles()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile)
    setFormData({
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as 'admin' | 'instructor' | 'user',
      departmentId: profile.department_id || '',
      password: '',
    })
    setShowForm(true)
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne brukeren?')) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId)

      if (error) throw error
      toast.success('Bruker slettet!')
      fetchUserAndProfiles()
    } catch (error: any) {
      toast.error('Kunne ikke slette bruker: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingProfile(null)
    setFormData({ email: '', fullName: '', role: 'user', departmentId: '', password: '' })
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator'
      case 'instructor': return 'Instruktør'
      case 'user': return 'Bruker'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'instructor': return 'bg-blue-100 text-blue-800'
      case 'user': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Brukere</h1>
          <p className="text-gray-600 dark:text-gray-300">Administrer bedriftens brukere</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny bruker
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {editingProfile ? 'Rediger bruker' : 'Ny bruker'}
              </h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="E-post"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={!!editingProfile}
                  placeholder="bruker@bedrift.no"
                />

                <Input
                  label="Fullt navn"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                  placeholder="Ola Nordmann"
                />

                {!editingProfile && (
                  <Input
                    label="Passord"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    placeholder="Minst 6 tegn"
                  />
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rolle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    required
                  >
                    <option value="user">Bruker</option>
                    <option value="instructor">Instruktør</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Avdeling
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="">Ingen avdeling</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingProfile ? 'Oppdater' : 'Opprett'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Avbryt
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users List */}
      <div className="grid gap-4">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary-700 font-medium">
                          {generateInitials(profile.full_name)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {profile.full_name || 'Ukjent bruker'}
                      </h3>
                      <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center space-x-1">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{profile.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(profile.role)}`}>
                          {getRoleText(profile.role)}
                        </span>
                        {profile.departments && (
                          <span className="text-sm text-gray-600">
                            {profile.departments.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Opprettet: {new Date(profile.created_at).toLocaleDateString('no-NO')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(profile)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(profile.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Ingen brukere ennå
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Opprett din første bruker for å komme i gang
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opprett bruker
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
