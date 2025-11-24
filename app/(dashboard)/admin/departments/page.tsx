'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Building2, UserPlus, UserMinus } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Department {
  id: string
  name: string
  description: string | null
  created_at: string
  userCount?: number
}

interface User {
  id: string
  role: string
  company_id: string
}

interface Profile {
  id: string
  full_name: string
  email: string
  department_id: string | null
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [departmentUsers, setDepartmentUsers] = useState<Profile[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    fetchUserAndDepartments()
  }, [])

  const fetchUserAndDepartments = async () => {
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

      // Fetch departments for the user's company
      const { data: departmentsData, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      // Fetch user counts for each department
      const { data: profiles } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('company_id', profile.company_id)
      
      // Add user count to each department
      const departmentsWithCounts = (departmentsData || []).map(dept => ({
        ...dept,
        userCount: (profiles || []).filter(p => p.department_id === dept.id).length
      }))
      
      setDepartments(departmentsWithCounts)
    } catch (error: any) {
      toast.error('Kunne ikke hente avdelinger: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (editingDepartment) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: formData.name,
            description: formData.description || null,
          })
          .eq('id', editingDepartment.id)

        if (error) throw error
        toast.success('Avdeling oppdatert!')
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert([{
            name: formData.name,
            description: formData.description || null,
            company_id: user.company_id,
          }])

        if (error) throw error
        toast.success('Avdeling opprettet!')
      }

      setShowForm(false)
      setEditingDepartment(null)
      setFormData({ name: '', description: '' })
      fetchUserAndDepartments()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = async (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      description: department.description || '',
    })
    
    // Fetch all profiles in the company
    if (user) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, department_id')
        .eq('company_id', user.company_id)
        .order('full_name')
      
      setAllProfiles(profiles || [])
      
      // Filter users in this department
      const usersInDept = (profiles || []).filter(p => p.department_id === department.id)
      setDepartmentUsers(usersInDept)
    }
    
    setShowForm(true)
  }

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne avdelingen?')) return

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId)

      if (error) throw error
      toast.success('Avdeling slettet!')
      fetchUserAndDepartments()
    } catch (error: any) {
      toast.error('Kunne ikke slette avdeling: ' + error.message)
    }
  }

  const handleAddUserToDepartment = async (userId: string) => {
    if (!editingDepartment) return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department_id: editingDepartment.id })
        .eq('id', userId)
      
      if (error) throw error
      
      toast.success('Bruker lagt til avdeling!')
      
      // Refresh the user list
      const updatedProfile = allProfiles.find(p => p.id === userId)
      if (updatedProfile) {
        setDepartmentUsers([...departmentUsers, { ...updatedProfile, department_id: editingDepartment.id }])
      }
    } catch (error: any) {
      toast.error('Kunne ikke legge til bruker: ' + error.message)
    }
  }

  const handleRemoveUserFromDepartment = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department_id: null })
        .eq('id', userId)
      
      if (error) throw error
      
      toast.success('Bruker fjernet fra avdeling!')
      
      // Refresh the user list
      setDepartmentUsers(departmentUsers.filter(u => u.id !== userId))
    } catch (error: any) {
      toast.error('Kunne ikke fjerne bruker: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingDepartment(null)
    setFormData({ name: '', description: '' })
    setDepartmentUsers([])
    setAllProfiles([])
  }

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Avdelinger</h1>
          <p className="text-gray-600 dark:text-gray-300">Administrer bedriftens avdelinger</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Ny avdeling
        </Button>
      </div>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={resetForm}>
        <Card className="w-full max-w-2xl bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingDepartment ? 'Rediger avdeling' : 'Ny avdeling'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Avdelingsnavn"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                placeholder="F.eks. IT-avdelingen"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Beskrivelse
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                  rows={3}
                  placeholder="Valgfri beskrivelse av avdelingen"
                />
              </div>

              {/* User Management Section - Only when editing */}
              {editingDepartment && (
                <div className="border-t pt-4 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Brukere i avdelingen
                  </h4>
                  
                  {/* Users in department */}
                  {departmentUsers.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {departmentUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUserFromDepartment(user.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ingen brukere i denne avdelingen</p>
                  )}
                  
                  {/* Available users to add */}
                  {allProfiles.filter(p => !departmentUsers.find(du => du.id === p.id)).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Legg til bruker
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {allProfiles
                          .filter(p => !departmentUsers.find(du => du.id === p.id))
                          .map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.full_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddUserToDepartment(user.id)}
                                className="text-primary-600 hover:text-primary-700"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingDepartment ? 'Oppdater' : 'Opprett'}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Modal>

      {/* Departments List */}
      <div className="grid gap-4">
        {departments.length > 0 ? (
          departments.map((department) => (
            <Card key={department.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building2 className="w-6 h-6 text-primary-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {department.name}
                      </h3>
                      {department.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {department.description || 'Ingen beskrivelse'}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Opprettet: {new Date(department.created_at).toLocaleDateString('no-NO')}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {department.userCount || 0} bruker{department.userCount !== 1 ? 'e' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(department)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(department.id)}
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
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Ingen avdelinger ennå
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Opprett din første avdeling for å organisere brukerne
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opprett avdeling
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
