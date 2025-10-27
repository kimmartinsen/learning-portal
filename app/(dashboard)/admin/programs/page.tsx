'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, BookOpen, Users, Calendar, Award, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface TrainingProgram {
  id: string
  title: string
  description: string | null
  is_mandatory: boolean
  deadline: string | null
  repetition_enabled: boolean
  repetition_interval_months: number | null
  badge_enabled: boolean
  created_at: string
  instructor_id?: string | null
  instructor?: {
    full_name: string
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

interface Instructor {
  id: string
  full_name: string
}

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null)
  const [user, setUser] = useState<User | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructorId: '',
    isMandatory: false,
    deadline: '',
    repetitionEnabled: false,
    repetitionInterval: 12,
    badgeEnabled: true,
    selectedDepartments: [] as string[]
  })

  useEffect(() => {
    fetchUserAndData()
  }, [])

  const fetchUserAndData = async () => {
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
      await Promise.all([
        fetchPrograms(profile.company_id),
        fetchDepartments(profile.company_id),
        fetchInstructors(profile.company_id)
      ])
    } catch (error: any) {
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrograms = async (companyId: string) => {
    const { data, error } = await supabase
      .from('training_programs')
      .select(`
        *,
        instructor:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    setPrograms(data || [])
  }

  const fetchDepartments = async (companyId: string) => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')

    if (error) throw error
    setDepartments(data || [])
  }

  const fetchInstructors = async (companyId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .in('role', ['admin', 'instructor'])
      .order('full_name')

    if (error) throw error
    setInstructors(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const programData = {
        title: formData.title,
        description: formData.description || null,
        instructor_id: formData.instructorId || null,
        is_mandatory: formData.isMandatory,
        deadline: formData.deadline || null,
        repetition_enabled: formData.repetitionEnabled,
        repetition_interval_months: formData.repetitionEnabled ? formData.repetitionInterval : null,
        badge_enabled: formData.badgeEnabled,
        company_id: user.company_id
      }

      let programId: string

      if (editingProgram) {
        // Update existing program
        const { error } = await supabase
          .from('training_programs')
          .update(programData)
          .eq('id', editingProgram.id)

        if (error) throw error
        programId = editingProgram.id
        toast.success('Program oppdatert!')
      } else {
        // Create new program
        const { data, error } = await supabase
          .from('training_programs')
          .insert([programData])
          .select()
          .single()

        if (error) throw error
        programId = data.id
        toast.success('Program opprettet!')
      }

      // Update program-department assignments
      if (formData.selectedDepartments.length > 0) {
        // First delete existing assignments for this program
        await supabase
          .from('program_departments')
          .delete()
          .eq('program_id', programId)

        // Insert new assignments
        const assignments = formData.selectedDepartments.map(deptId => ({
          program_id: programId,
          department_id: deptId
        }))

        const { error: assignError } = await supabase
          .from('program_departments')
          .insert(assignments)

        if (assignError) throw assignError
      }

      resetForm()
      fetchPrograms(user.company_id)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (program: TrainingProgram) => {
    setEditingProgram(program)
    setFormData({
      title: program.title,
      description: program.description || '',
      instructorId: program.instructor_id || '',
      isMandatory: program.is_mandatory,
      deadline: program.deadline || '',
      repetitionEnabled: program.repetition_enabled,
      repetitionInterval: program.repetition_interval_months || 12,
      badgeEnabled: program.badge_enabled,
      selectedDepartments: [] // TODO: Fetch existing assignments
    })
    setShowForm(true)
  }

  const handleDelete = async (programId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette programmet?')) return

    try {
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', programId)

      if (error) throw error
      toast.success('Program slettet!')
      fetchPrograms(user!.company_id)
    } catch (error: any) {
      toast.error('Kunne ikke slette program: ' + error.message)
    }
  }

  const handleEditModules = (program: TrainingProgram) => {
    // Navigate to module builder
    window.location.href = `/admin/programs/${program.id}/modules`
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingProgram(null)
    setFormData({
      title: '',
      description: '',
      instructorId: '',
      isMandatory: false,
      deadline: '',
      repetitionEnabled: false,
      repetitionInterval: 12,
      badgeEnabled: true,
      selectedDepartments: []
    })
  }

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opplæringsprogrammer</h1>
          <p className="text-gray-600">Administrer bedriftens opplæringsprogrammer</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nytt program
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {editingProgram ? 'Rediger program' : 'Nytt opplæringsprogram'}
              </h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Programtittel"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  placeholder="F.eks. Sikkerhet på arbeidsplassen"
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beskrivelse
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    rows={3}
                    placeholder="Beskrivelse av programmet"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instruktør
                  </label>
                  <select
                    value={formData.instructorId}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructorId: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="">Ingen instruktør</option>
                    {instructors.map(instructor => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isMandatory}
                        onChange={(e) => setFormData(prev => ({ ...prev, isMandatory: e.target.checked }))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Obligatorisk</span>
                    </label>
                  </div>
                  
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.badgeEnabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, badgeEnabled: e.target.checked }))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Badge ved fullføring</span>
                    </label>
                  </div>
                </div>

                <Input
                  label="Frist (valgfri)"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                />

                <div>
                  <label className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      checked={formData.repetitionEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, repetitionEnabled: e.target.checked }))}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Aktiver repetisjon</span>
                  </label>
                  
                  {formData.repetitionEnabled && (
                    <Input
                      label="Repetisjon hver (måneder)"
                      type="number"
                      min="1"
                      max="60"
                      value={formData.repetitionInterval}
                      onChange={(e) => setFormData(prev => ({ ...prev, repetitionInterval: parseInt(e.target.value) }))}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tildel til avdelinger
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                    {departments.map(dept => (
                      <label key={dept.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.selectedDepartments.includes(dept.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                selectedDepartments: [...prev.selectedDepartments, dept.id]
                              }))
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                selectedDepartments: prev.selectedDepartments.filter(id => id !== dept.id)
                              }))
                            }
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingProgram ? 'Oppdater program' : 'Opprett program'}
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

      {/* Programs List */}
      <div className="grid gap-4">
        {programs.length > 0 ? (
          programs.map((program) => (
            <Card key={program.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {program.title}
                      </h3>
                      {program.is_mandatory && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Obligatorisk
                        </span>
                      )}
                      {program.badge_enabled && (
                        <Award className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    
                    {program.description && (
                      <p className="text-gray-600 mb-3">{program.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {program.instructor && (
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{program.instructor.full_name}</span>
                        </div>
                      )}
                      
                      {program.deadline && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Frist: {new Date(program.deadline).toLocaleDateString('no-NO')}</span>
                        </div>
                      )}
                      
                      <span>Opprettet: {new Date(program.created_at).toLocaleDateString('no-NO')}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditModules(program)}
                      title="Rediger moduler"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(program)}
                      title="Rediger program"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(program.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Slett program"
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
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ingen programmer ennå
              </h3>
              <p className="text-gray-600 mb-4">
                Opprett ditt første opplæringsprogram for å komme i gang
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opprett program
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
