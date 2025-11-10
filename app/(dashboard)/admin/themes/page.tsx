'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Theme, CreateThemeFormData } from '@/types/enhanced-database.types'

interface User {
  id: string
  role: string
  company_id: string
}

type ThemeProgram = {
  id: string
  title: string
  description: string | null
}

type ProfileRecord = {
  id: string
  full_name: string | null
  department_id: string | null
  email: string | null
}

type UserAssignmentView = {
  id: string
  program_id: string
  user_id: string | null
  due_date: string | null
  status: string | null
  completed_at: string | null
  assigned_at: string | null
  notes: string | null
  calculated_status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | null
  progress_percentage: number | null
}

type UserProgressRow = {
  user_id: string
  program_id: string
  module_id: string
  status: string | null
}

type UserProgramStatus = {
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  completedModules: number
  totalModules: number
  progressPercent: number
  dueDate: string | null
  completedAt: string | null
}

type ThemeUserRow = {
  userId: string
  name: string
  email: string | null
  departmentName: string
  programs: Record<string, UserProgramStatus>
}

type ThemeProgressData = {
  programs: ThemeProgram[]
  userRows: ThemeUserRow[]
  summary: {
    totalAssignments: number
    completedCount: number
    overdueCount: number
    inProgressCount: number
  }
}

type ThemeProgressState = {
  loading: boolean
  data?: ThemeProgressData
  error?: string
}

const statusConfig: Record<
  UserProgramStatus['status'],
  { label: string; badgeClass: string; icon: JSX.Element }
> = {
  completed: {
    label: 'Fullført',
    badgeClass: 'bg-green-100 text-green-700 border border-green-200',
    icon: <CheckCircle className="w-4 h-4" />
  },
  in_progress: {
    label: 'I gang',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200',
    icon: <Clock className="w-4 h-4" />
  },
  overdue: {
    label: 'Forsinket',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    icon: <AlertTriangle className="w-4 h-4" />
  },
  not_started: {
    label: 'Ikke startet',
    badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200',
    icon: <Clock className="w-4 h-4" />
  }
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<Record<string, ThemeProgressState>>({})
  
  const [formData, setFormData] = useState<CreateThemeFormData>({
    name: '',
    description: '',
  })

  useEffect(() => {
    fetchUserAndThemes()
  }, [])

  const fetchUserAndThemes = async () => {
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

      // Fetch themes for the user's company
      const { data: themesData, error } = await supabase
        .from('themes')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setThemes(themesData || [])
    } catch (error: any) {
      toast.error('Kunne ikke hente temaer: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (editingTheme) {
        // Update existing theme
        const { error } = await supabase
          .from('themes')
          .update({
            name: formData.name,
            description: formData.description || null,
          })
          .eq('id', editingTheme.id)

        if (error) throw error
        toast.success('Tema oppdatert!')
      } else {
        // Create new theme
        const { error } = await supabase
          .from('themes')
          .insert([{
            name: formData.name,
            description: formData.description || null,
            company_id: user.company_id,
          }])

        if (error) throw error
        toast.success('Tema opprettet!')
      }

      setShowForm(false)
      setEditingTheme(null)
      setFormData({ name: '', description: '' })
      fetchUserAndThemes()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (theme: Theme) => {
    setEditingTheme(theme)
    setFormData({
      name: theme.name,
      description: theme.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (themeId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette temaet? Alle tilhørende kurs vil miste tema-tilknytningen.')) return

    try {
      const { error } = await supabase
        .from('themes')
        .delete()
        .eq('id', themeId)

      if (error) throw error
      toast.success('Tema slettet!')
      fetchUserAndThemes()
    } catch (error: any) {
      toast.error('Kunne ikke slette tema: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTheme(null)
    setFormData({ name: '', description: '' })
  }

  // Get program count for each theme
  const handleToggleTheme = (themeId: string) => {
    if (expandedThemeId === themeId) {
      setExpandedThemeId(null)
      return
    }

    setExpandedThemeId(themeId)

    if (!progressState[themeId]) {
      fetchThemeProgress(themeId)
    }
  }

  const fetchThemeProgress = async (themeId: string) => {
    if (!user) {
      toast.error('Kunne ikke hente brukerdata')
      return
    }

    setProgressState(prev => ({
      ...prev,
      [themeId]: { loading: true }
    }))

    try {
      const { data: programsData, error: programsError } = await supabase
        .from('training_programs')
        .select('id, title, description')
        .eq('theme_id', themeId)
        .order('created_at', { ascending: true })

      if (programsError) {
        throw programsError
      }

      const programs = (programsData as ThemeProgram[] | null) || []

      if (programs.length === 0) {
        setProgressState(prev => ({
          ...prev,
          [themeId]: {
            loading: false,
            data: {
              programs: [],
              userRows: [],
              summary: {
                totalAssignments: 0,
                completedCount: 0,
                overdueCount: 0,
                inProgressCount: 0
              }
            }
          }
        }))
        return
      }

      const programIds = programs.map(program => program.id)

      const { data: moduleRows, error: modulesError } = await supabase
        .from('modules')
        .select('id, program_id')
        .in('program_id', programIds)

      if (modulesError) {
        throw modulesError
      }

      const modulesByProgram = ((moduleRows as { id: string; program_id: string }[] | null) || []).reduce<
        Record<string, string[]>
      >((acc, module) => {
        if (!acc[module.program_id]) {
          acc[module.program_id] = []
        }
        acc[module.program_id].push(module.id)
        return acc
      }, {})

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('user_assignments')
        .select(
          'id, program_id, user_id, due_date, status, completed_at, assigned_at, notes, calculated_status, progress_percentage'
        )
        .in('program_id', programIds)
        .not('user_id', 'is', null)

      if (assignmentError) {
        throw assignmentError
      }

      const assignments = (assignmentRows as UserAssignmentView[] | null) || []

      const userIds = Array.from(
        new Set(
          assignments
            .map((assignment) => assignment.user_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      let profileMap = new Map<string, ProfileRecord>()
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, department_id, email')
          .in('id', userIds)

        if (profilesError) {
          throw profilesError
        }

        profileMap = new Map(
          ((profileRows as ProfileRecord[] | null) || []).map((profile) => [profile.id, profile])
        )
      }

      let progressRows: UserProgressRow[] = []
      if (userIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('user_id, program_id, module_id, status')
          .in('program_id', programIds)
          .in('user_id', userIds)

        if (progressError) {
          throw progressError
        }

        progressRows = (progressData as UserProgressRow[] | null) || []
      }

      const progressMap = new Map<
        string,
        { completed: number; hasInProgress: boolean; hasStarted: boolean }
      >()

      progressRows.forEach((entry) => {
        const key = `${entry.user_id}:${entry.program_id}`
        const existing = progressMap.get(key) || {
          completed: 0,
          hasInProgress: false,
          hasStarted: false
        }

        if (entry.status === 'completed') {
          existing.completed += 1
          existing.hasStarted = true
        } else if (entry.status === 'in_progress') {
          existing.hasInProgress = true
          existing.hasStarted = true
        } else if (entry.status && entry.status !== 'not_started') {
          existing.hasStarted = true
        }

        progressMap.set(key, existing)
      })

      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', user.company_id)

      if (departmentsError) {
        throw departmentsError
      }

      const departmentMap = (departmentsData as { id: string; name: string }[] | null)?.reduce<
        Record<string, string>
      >((acc, department) => {
        acc[department.id] = department.name
        return acc
      }, {}) || {}

      const userMap = new Map<string, ThemeUserRow>()
      let completedCount = 0
      let overdueCount = 0
      let inProgressCount = 0

      assignments.forEach(assignment => {
        if (!assignment.user_id) {
          return
        }

        const profile = profileMap.get(assignment.user_id)
        if (!profile) {
          return
        }

        const userId = profile.id

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            name: profile.full_name || 'Ukjent bruker',
            email: profile.email,
            departmentName: profile.department_id
              ? departmentMap[profile.department_id] || 'Uten avdeling'
              : 'Uten avdeling',
            programs: {}
          })
        }

        const row = userMap.get(userId)!
        const totalModules = modulesByProgram[assignment.program_id]?.length ?? 0

        const progressKey = `${userId}:${assignment.program_id}`
        const progressInfo = progressMap.get(progressKey)
        const completedModules = progressInfo?.completed ?? 0
        const hasInProgress = progressInfo?.hasInProgress ?? false
        const hasStarted = progressInfo?.hasStarted ?? false

        let status: UserProgramStatus['status'] =
          (assignment.calculated_status as UserProgramStatus['status']) ||
          (assignment.completed_at
            ? 'completed'
            : assignment.status === 'started' || hasStarted
            ? 'in_progress'
            : 'not_started')

        if (
          status !== 'completed' &&
          assignment.due_date &&
          new Date(assignment.due_date) < new Date()
        ) {
          status = 'overdue'
        } else if (status === 'not_started' && hasInProgress) {
          status = 'in_progress'
        }

        if (status === 'completed') {
          completedCount += 1
        } else if (status === 'overdue') {
          overdueCount += 1
        } else if (status === 'in_progress') {
          inProgressCount += 1
        }

        const derivedProgress =
          totalModules > 0
            ? Math.round((completedModules / totalModules) * 100)
            : status === 'completed'
            ? 100
            : 0

        const progressPercent =
          typeof assignment.progress_percentage === 'number'
            ? Math.max(0, Math.min(100, Math.round(assignment.progress_percentage)))
            : derivedProgress

        row.programs[assignment.program_id] = {
          status,
          completedModules,
          totalModules,
          progressPercent,
          dueDate: assignment.due_date,
          completedAt: assignment.completed_at
        }
      })

      setProgressState(prev => ({
        ...prev,
        [themeId]: {
          loading: false,
          data: {
            programs,
            userRows: Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
            summary: {
              totalAssignments: assignments.length,
              completedCount,
              overdueCount,
              inProgressCount
            }
          }
        }
      }))
    } catch (error: any) {
      console.error('Error fetching theme progress:', error)
      toast.error('Kunne ikke hente progresjon for temaet')

      setProgressState(prev => ({
        ...prev,
        [themeId]: {
          loading: false,
          error: 'Kunne ikke hente progresjon'
        }
      }))
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
          <h1 className="text-2xl font-bold text-gray-900">Temaer</h1>
          <p className="text-gray-600">Organiser kurs i temaer for bedre struktur</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nytt tema
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">
                {editingTheme ? 'Rediger tema' : 'Nytt tema'}
              </h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Temanavn"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="F.eks. HMS og Sikkerhet"
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
                    placeholder="Valgfri beskrivelse av temaet"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingTheme ? 'Oppdater' : 'Opprett'}
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

      {/* Themes List */}
      <div className="grid gap-4">
        {themes.length > 0 ? (
          themes.map((theme) => {
            const isExpanded = expandedThemeId === theme.id
            const progress = progressState[theme.id]

            return (
              <Card key={theme.id}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleTheme(theme.id)}
                      className="flex items-center space-x-2 text-left text-sm font-medium text-gray-900 focus:outline-none"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <span>{theme.name}</span>
                    </button>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(theme)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(theme.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 px-4 py-4">
                      {progress?.loading ? (
                        <div className="py-6 text-center text-sm text-gray-500">
                          Laster progresjon...
                        </div>
                      ) : progress?.error ? (
                        <div className="py-6 text-center text-sm text-red-600">
                          {progress.error}
                        </div>
                      ) : progress?.data ? (() => {
                        const data = progress.data
                        return data.programs.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">
                            Ingen kurs er knyttet til dette temaet.
                          </div>
                        ) : data.userRows.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">
                            Ingen brukere er tildelt kurs i dette temaet ennå.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="w-64 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                                      Bruker
                                    </th>
                                    {data.programs.map((program) => (
                                      <th
                                        key={program.id}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
                                      >
                                        {program.title}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {data.userRows.map((row) => (
                                    <tr key={row.userId}>
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {row.name}
                                      </td>
                                      {data.programs.map((program) => {
                                        const status = row.programs[program.id]

                                        if (!status) {
                                          return (
                                            <td key={`${row.userId}-${program.id}`} className="px-4 py-3 align-middle">
                                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
                                                Ikke tildelt
                                              </span>
                                            </td>
                                          )
                                        }

                                        const config = statusConfig[status.status]

                                        return (
                                          <td key={`${row.userId}-${program.id}`} className="px-4 py-3 align-middle">
                                            <span
                                              className={`inline-flex items-center space-x-1 rounded-full border px-2 py-1 text-xs font-medium ${config.badgeClass}`}
                                            >
                                              {config.icon}
                                              <span>{config.label}</span>
                                            </span>
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })() : (
                        <div className="py-6 text-center text-sm text-gray-500">
                          Ingen data å vise ennå.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Ingen temaer ennå
              </h3>
              <p className="text-gray-600">
                Opprett ditt første tema for å organisere kursene
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Opprett tema
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}