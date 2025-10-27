'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, BookOpen, Users, Clock, Settings, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EnhancedTrainingProgram, Theme } from '@/types/enhanced-database.types'

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
  const [programs, setPrograms] = useState<EnhancedTrainingProgram[]>([])
  const [themes, setThemes] = useState<Theme[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProgram, setEditingProgram] = useState<EnhancedTrainingProgram | null>(null)
  const [user, setUser] = useState<User | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    themeId: '',
    instructorId: '',
    deadlineDays: 14,
    repetitionEnabled: false,
    repetitionInterval: 12,
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
        fetchThemes(profile.company_id),
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
        theme:themes(id, name),
        instructor:profiles(full_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    setPrograms(data || [])
  }

  const fetchThemes = async (companyId: string) => {
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('company_id', companyId)
      .order('order_index', { ascending: true })

    if (error) throw error
    setThemes(data || [])
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
        theme_id: formData.themeId || null,
        instructor_id: formData.instructorId || null,
        deadline_days: formData.deadlineDays,
        repetition_enabled: formData.repetitionEnabled,
        repetition_interval_months: formData.repetitionEnabled ? formData.repetitionInterval : null,
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
        toast.success('Kurs oppdatert!')
      } else {
        // Create new program
        const { data, error } = await supabase
          .from('training_programs')
          .insert([programData])
          .select()
          .single()

        if (error) throw error
        programId = data.id
        toast.success('Kurs opprettet!')
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

  const handleEdit = (program: EnhancedTrainingProgram) => {
    setEditingProgram(program)
    setFormData({
      title: program.title,
      description: program.description || '',
      themeId: program.theme_id || '',
      instructorId: program.instructor_id || '',
      deadlineDays: program.deadline_days || 14,
      repetitionEnabled: program.repetition_enabled || false,
      repetitionInterval: program.repetition_interval_months || 12,
      selectedDepartments: [] // TODO: Fetch existing assignments
    })
    setShowForm(true)
  }

  const handleDelete = async (programId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette kurset?')) return

    try {
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', programId)

      if (error) throw error
      toast.success('Kurs slettet!')
      fetchPrograms(user!.company_id)
    } catch (error: any) {
      toast.error('Kunne ikke slette kurs: ' + error.message)
    }
  }

  const handleEditModules = (program: EnhancedTrainingProgram) => {
    // Navigate to module builder
    window.location.href = `/admin/programs/${program.id}/modules`
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingProgram(null)
    setFormData({
      title: '',
      description: '',
      themeId: '',
      instructorId: '',
      deadlineDays: 14,
      repetitionEnabled: false,
      repetitionInterval: 12,
      selectedDepartments: []
    })
  }

  // Group programs by theme
  const programsByTheme = programs.reduce((acc, program) => {
    const themeId = program.theme_id || 'no-theme'
    if (!acc[themeId]) {
      acc[themeId] = []
    }
    acc[themeId].push(program)
    return acc
  }, {} as Record<string, EnhancedTrainingProgram[]>)

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kurs</h1>
          <p className="text-gray-600">Administrer bedriftens kurs organisert i temaer</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nytt kurs
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {editingProgram ? 'Rediger kurs' : 'Nytt kurs'}
              </h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Kurstittel"
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
                    placeholder="Beskrivelse av kurset"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tema
                  </label>
                  <select
                    value={formData.themeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, themeId: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="">Velg tema (valgfritt)</option>
                    {themes.map(theme => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                  {themes.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      <a href="/admin/themes" className="text-primary-600 hover:text-primary-700">
                        Opprett temaer først
                      </a> for å organisere kursene
                    </p>
                  )}
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

                <Input
                  label="Frist (antall dager)"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.deadlineDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadlineDays: parseInt(e.target.value) || 14 }))}
                  placeholder="14"
                  helper="Antall dager brukere har til å fullføre kurset"
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
                    {editingProgram ? 'Oppdater kurs' : 'Opprett kurs'}
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

      {/* Programs List - Grouped by Theme */}
      <div className="space-y-6">
        {themes.map(theme => {
          const themePrograms = programsByTheme[theme.id] || []
          if (themePrograms.length === 0) return null

          return (
            <div key={theme.id} className="space-y-3">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">{theme.name}</h2>
                <span className="text-sm text-gray-500">({themePrograms.length} kurs)</span>
              </div>
              
              <div className="grid gap-3 ml-7">
                {themePrograms.map((program) => (
                  <Card key={program.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {program.title}
                          </h3>
                          
                          {program.description && (
                            <p className="text-sm text-gray-600 mb-2">{program.description}</p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {program.instructor && (
                              <div className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span>{program.instructor.full_name}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{program.deadline_days} dager frist</span>
                            </div>
                            
                            <span>Opprettet: {new Date(program.created_at).toLocaleDateString('no-NO')}</span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-1">
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
                            title="Rediger kurs"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(program.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Slett kurs"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}

        {/* Programs without theme */}
        {programsByTheme['no-theme'] && programsByTheme['no-theme'].length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-500">Uten tema</h2>
              <span className="text-sm text-gray-400">({programsByTheme['no-theme'].length} kurs)</span>
            </div>
            
            <div className="grid gap-3 ml-7">
              {programsByTheme['no-theme'].map((program) => (
                <Card key={program.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 mb-1">
                          {program.title}
                        </h3>
                        
                        {program.description && (
                          <p className="text-sm text-gray-600 mb-2">{program.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {program.instructor && (
                            <div className="flex items-center space-x-1">
                              <Users className="w-3 h-3" />
                              <span>{program.instructor.full_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{program.deadline_days} dager frist</span>
                          </div>
                          
                          <span>Opprettet: {new Date(program.created_at).toLocaleDateString('no-NO')}</span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-1">
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
                          title="Rediger kurs"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(program.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Slett kurs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {programs.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ingen kurs ennå
              </h3>
              <p className="text-gray-600 mb-4">
                Opprett ditt første kurs for å komme i gang
              </p>
              {themes.length === 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  Tip: <a href="/admin/themes" className="text-primary-600 hover:text-primary-700">
                    Opprett temaer først
                  </a> for bedre organisering
                </p>
              )}
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opprett kurs
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}