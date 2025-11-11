'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Users,
  Clock,
  Settings,
  Tag,
  ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EnhancedTrainingProgram, Theme, CreateThemeFormData } from '@/types/enhanced-database.types'
import { AssignmentSelector } from '@/components/admin/AssignmentSelector'

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
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProgram, setEditingProgram] = useState<EnhancedTrainingProgram | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showThemeForm, setShowThemeForm] = useState(false)
  const [themeFormData, setThemeFormData] = useState<CreateThemeFormData>({
    name: '',
    description: ''
  })
  const [creatingTheme, setCreatingTheme] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    themeId: '',
    instructorId: '',
    deadlineDays: 14,
    repetitionEnabled: false,
    repetitionInterval: 12,
    assignment: {
      type: 'department' as 'department' | 'individual',
      departmentIds: [] as string[],
      userIds: [] as string[]
    }
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
      .order('created_at', { ascending: true })

    if (error) throw error
    setThemes(data || [])
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

      // Create assignments
      if (formData.assignment.departmentIds.length > 0 || formData.assignment.userIds.length > 0) {
        let assignedUserIds: string[] = []
        
        if (formData.assignment.type === 'department') {
          // Department assignments
          for (const departmentId of formData.assignment.departmentIds) {
            const { error: funcError } = await supabase.rpc('assign_program_to_department', {
              p_program_id: programId,
              p_department_id: departmentId,
              p_assigned_by: user.id,
              p_notes: editingProgram ? 'Oppdatert kurs' : 'Nytt kurs'
            })
            
            if (funcError) throw funcError
            
            // Get users in this department
            const { data: deptUsers } = await supabase
              .from('profiles')
              .select('id')
              .eq('department_id', departmentId)
            
            if (deptUsers) {
              assignedUserIds.push(...deptUsers.map(u => u.id))
            }
          }
        } else {
          // Individual assignments
          for (const userId of formData.assignment.userIds) {
            const { error: funcError } = await supabase.rpc('assign_program_to_user', {
              p_program_id: programId,
              p_user_id: userId,
              p_assigned_by: user.id,
              p_notes: editingProgram ? 'Oppdatert kurs' : 'Nytt kurs'
            })
            
            if (funcError) throw funcError
            assignedUserIds.push(userId)
          }
        }
        
        // Send notifications to all assigned users
        if (assignedUserIds.length > 0 && !editingProgram) {
          console.log('Creating notifications for users:', assignedUserIds)
          
          const notifications = assignedUserIds.map(userId => ({
            user_id: userId,
            type: 'assignment_created',
            title: '📚 Nytt kurs tildelt',
            message: `Du har fått tildelt "${formData.title}". Frist: ${formData.deadlineDays} dager`,
            link: `/programs/${programId}`,
            read: false,
            metadata: {
              programId,
              deadlineDays: formData.deadlineDays
            }
          }))
          
          console.log('Notification data:', notifications)
          
          const { data: notifData, error: notifError } = await supabase
            .from('notifications')
            .insert(notifications)
            .select()
          
          if (notifError) {
            console.error('Error creating notifications:', notifError)
            toast.error('Kurset ble opprettet, men varsling feilet: ' + notifError.message)
          } else {
            console.log('Notifications created successfully:', notifData)
            toast.success(`Varsling sendt til ${assignedUserIds.length} bruker(e)`)
          }
        } else {
          console.log('No notifications sent. assignedUserIds:', assignedUserIds.length, 'editingProgram:', editingProgram)
        }
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
      assignment: {
        type: 'department',
        departmentIds: [],
        userIds: []
      } // TODO: Fetch existing assignments when editing
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
      assignment: {
        type: 'department',
        departmentIds: [],
        userIds: []
      }
    })
  }

  const resetThemeForm = () => {
    setShowThemeForm(false)
    setThemeFormData({ name: '', description: '' })
    setCreatingTheme(false)
  }

  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setCreatingTheme(true)
      const { data, error } = await supabase
        .from('themes')
        .insert([
          {
            name: themeFormData.name,
            description: themeFormData.description || null,
            company_id: user.company_id
          }
        ])
        .select()
        .single()

      if (error) throw error

      toast.success('Tema opprettet!')
      await fetchThemes(user.company_id)
      setFormData((prev) => ({
        ...prev,
        themeId: data?.id || prev.themeId
      }))
      resetThemeForm()
    } catch (error: any) {
      toast.error(error.message)
      setCreatingTheme(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kurs</h1>
          <p className="text-gray-600 dark:text-gray-300">Administrer kurs og temaer for bedriften</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowThemeForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nytt tema
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nytt kurs
          </Button>
        </div>
      </div>

      {/* Theme Form Modal */}
      <Modal isOpen={showThemeForm} onClose={resetThemeForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nytt tema</h3>
          </CardHeader>
          <CardContent>
              <form onSubmit={handleCreateTheme} className="space-y-3">
              <Input
                label="Temanavn"
                value={themeFormData.name}
                onChange={(e) => setThemeFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="F.eks. HMS og sikkerhet"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Beskrivelse
                </label>
                <textarea
                  value={themeFormData.description}
                  onChange={(e) =>
                    setThemeFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                  rows={3}
                  placeholder="Valgfri beskrivelse av temaet"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1" loading={creatingTheme}>
                  Opprett tema
                </Button>
                <Button type="button" variant="secondary" onClick={resetThemeForm} disabled={creatingTheme}>
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Modal>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={resetForm} size="lg">
        <Card className="bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingProgram ? 'Rediger kurs' : 'Nytt kurs'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Kurstittel"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="F.eks. Sikkerhet på arbeidsplassen"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Beskrivelse
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
                  rows={3}
                  placeholder="Beskrivelse av kurset"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tema
                </label>
                <select
                  value={formData.themeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, themeId: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="">Velg tema (valgfritt)</option>
                  {themes.map(theme => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
                {themes.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <a href="/admin/themes" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                      Opprett temaer først
                    </a> for å organisere kursene
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instruktør
                </label>
                <select
                  value={formData.instructorId}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructorId: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
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
                <label className="flex items-center mb-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.repetitionEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, repetitionEnabled: e.target.checked }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2">Aktiver repetisjon</span>
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
                  Tildel kurs til
                </label>
                <AssignmentSelector
                  companyId={user?.company_id || ''}
                  onSelectionChange={(selection) => {
                    setFormData(prev => ({
                      ...prev,
                      assignment: selection
                    }))
                  }}
                  initialSelection={formData.assignment}
                />
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
      </Modal>

      {/* Programs List - Grouped by Theme */}
      <div className="space-y-4">
        {themes.map(theme => {
          const themePrograms = programsByTheme[theme.id] || []
          if (themePrograms.length === 0) return null

          return (
            <details
              key={theme.id}
              className="group rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800"
              open
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-200 group-open:rotate-90" />
                  <Tag className="h-4 w-4 text-primary-600" />
                  <span className="text-base font-semibold">{theme.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({themePrograms.length} kurs)</span>
                </div>
              </summary>

              <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {themePrograms.map((program) => (
                    <Card key={program.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify_between gap-3">
                          <div className="flex-1 space-y-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                              {program.title}
                            </h3>

                            {program.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-300">{program.description}</p>
                            )}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                              {program.instructor && (
                                <span className="inline-flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {program.instructor.full_name}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {program.deadline_days} dager frist
                              </span>
                              <span>
                                Opprettet: {new Date(program.created_at).toLocaleDateString('no-NO')}
                              </span>
                            </div>
                          </div>

                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditModules(program)}
                              title="Rediger moduler"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(program)}
                              title="Rediger kurs"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(program.id)}
                              className="text-red-600 hover:text-red-700 dark:hover:text-red-400"
                              title="Slett kurs"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </details>
          )
        })}

        {/* Programs without theme */}
        {programsByTheme['no-theme'] && programsByTheme['no-theme'].length > 0 && (
          <details className="group rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800" open>
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-200 group-open:rotate-90" />
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span className="text-base font-semibold text-gray-600 dark:text-gray-300">Uten tema</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  ({programsByTheme['no-theme'].length} kurs)
                </span>
              </div>
            </summary>

            <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {programsByTheme['no-theme'].map((program) => (
                  <Card key={program.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                            {program.title}
                          </h3>

                          {program.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">{program.description}</p>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            {program.instructor && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {program.instructor.full_name}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {program.deadline_days} dager frist
                            </span>
                            <span>
                              Opprettet: {new Date(program.created_at).toLocaleDateString('no-NO')}
                            </span>
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditModules(program)}
                            title="Rediger moduler"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(program)}
                            title="Rediger kurs"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(program.id)}
                            className="text-red-600 hover:text-red-700 dark:hover:text-red-400"
                            title="Slett kurs"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </details>
        )}

        {programs.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Ingen kurs ennå
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Opprett ditt første kurs for å komme i gang
              </p>
              {themes.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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