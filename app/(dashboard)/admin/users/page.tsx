'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users, Mail, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateInitials, cn } from '@/lib/utils'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  avatar_url: string | null
  created_at: string
  department_id: string | null
  user_departments?: {
    departments: {
      id: string
      name: string
    }
  }[]
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
    password: '',
    role: 'user' as 'admin' | 'user',
    departmentIds: [] as string[], // Flere avdelinger
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

      // Fetch profiles first (without joining departments to avoid ambiguity error)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      // Then fetch user_departments separately
      const { data: userDepartmentsData, error: udError } = await supabase
        .from('user_departments')
        .select(`
          user_id,
          departments (
            id,
            name
          )
        `)
        .in('user_id', profilesData.map(p => p.id))

      if (udError) throw udError

      // Combine the data
      const combinedProfiles = profilesData.map(p => {
        const userDepts = userDepartmentsData
          .filter(ud => ud.user_id === p.id)
          .map(ud => ({ departments: ud.departments }))
        
        return {
          ...p,
          user_departments: userDepts
        }
      })

      setProfiles(combinedProfiles)
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
          })
          .eq('id', editingProfile.id)

        if (error) throw error

        // Update user_departments relationship
        // First, delete existing department associations
        await supabase
          .from('user_departments')
          .delete()
          .eq('user_id', editingProfile.id)

        // Then add new departments
        if (formData.departmentIds.length > 0) {
          const deptInserts = formData.departmentIds.map(deptId => ({
            user_id: editingProfile.id,
            department_id: deptId,
          }))
          
          const { error: deptError } = await supabase
            .from('user_departments')
            .insert(deptInserts)
          
          if (deptError) throw deptError
        }

        toast.success('Bruker oppdatert!')
      } else {
        // Opprett bruker direkte
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true,
          user_metadata: {
            full_name: formData.fullName,
          }
        })

        if (authError) {
          // Fallback til client-side signup hvis admin method feiler
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
          if (!signupData.user) throw new Error('Kunne ikke opprette bruker')

          // Opprett profil
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: signupData.user.id,
              email: formData.email,
              full_name: formData.fullName,
              role: formData.role,
              company_id: user.company_id,
            }])

          if (profileError) throw profileError

          // Legg til avdelinger
          if (formData.departmentIds.length > 0) {
            const deptInserts = formData.departmentIds.map(deptId => ({
              user_id: signupData.user.id,
              department_id: deptId,
            }))
            
            const { error: deptError } = await supabase
              .from('user_departments')
              .insert(deptInserts)
            
            if (deptError) throw deptError
          }

          toast.success('Bruker opprettet!')
        } else {
          // Opprett profil
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: authData.user.id,
              email: formData.email,
              full_name: formData.fullName,
              role: formData.role,
              company_id: user.company_id,
            }])

          if (profileError) throw profileError

          // Legg til avdelinger
          if (formData.departmentIds.length > 0) {
            const deptInserts = formData.departmentIds.map(deptId => ({
              user_id: authData.user.id,
              department_id: deptId,
            }))
            
            const { error: deptError } = await supabase
              .from('user_departments')
              .insert(deptInserts)
            
            if (deptError) throw deptError
          }

          toast.success('Bruker opprettet!')
        }
      }

      setShowForm(false)
      setEditingProfile(null)
      setFormData({ email: '', fullName: '', password: '', role: 'user', departmentIds: [] })
      fetchUserAndProfiles()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile)
    // Get all departments from user_departments
    const departmentIds = (profile.user_departments || [])
      .map(ud => ud.departments?.id)
      .filter((id): id is string => id !== undefined)
    setFormData({
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as 'admin' | 'user',
      departmentIds: departmentIds,
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
      <Modal isOpen={showForm} onClose={resetForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingProfile ? 'Rediger bruker' : 'Ny bruker'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Fullt navn først */}
              <Input
                label="Fullt navn"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
                placeholder="Ola Nordmann"
              />

              {/* E-post kun for redigering */}
              {editingProfile && (
                <Input
                  label="E-post"
                  type="email"
                  value={formData.email}
                  disabled
                  placeholder="bruker@bedrift.no"
                />
              )}

              {/* E-post for ny bruker */}
              {!editingProfile && (
                <Input
                  label="E-post"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="bruker@bedrift.no"
                />
              )}

              {/* Passord for ny bruker */}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rolle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'user' }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                  required
                >
                  <option value="user">Bruker</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Instruktør settes per kurs, ikke som rolle.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Avdelinger
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900">
                  {departments.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      Ingen avdelinger tilgjengelig
                    </p>
                  ) : (
                    departments.map(dept => {
                      const isSelected = formData.departmentIds.includes(dept.id)
                      return (
                        <label
                          key={dept.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                            isSelected && "bg-primary-50 dark:bg-primary-900/20"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  departmentIds: [...prev.departmentIds, dept.id]
                                }))
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  departmentIds: prev.departmentIds.filter(id => id !== dept.id)
                                }))
                              }
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{dept.name}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Velg en eller flere avdelinger. Brukeren kan være med i flere avdelinger.
                </p>
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
      </Modal>

      {/* Users List */}
      <div className="grid gap-4">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex min-w-[220px] items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary-700 font-medium">
                          {generateInitials(profile.full_name)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {profile.full_name || 'Ukjent bruker'}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        <span className="truncate">{profile.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 ${getRoleColor(profile.role)}`}>
                      {getRoleText(profile.role)}
                    </span>
                    {profile.user_departments && profile.user_departments.length > 0 && (
                      <>
                        {profile.user_departments.map((ud) => (
                          <span key={ud.departments.id} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {ud.departments.name}
                          </span>
                        ))}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Opprettet {new Date(profile.created_at).toLocaleDateString('no-NO')}
                  </p>

                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(profile)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(profile.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
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
