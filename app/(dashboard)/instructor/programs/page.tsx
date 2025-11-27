'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, Lock, PauseCircle, Unlock, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Theme } from '@/types/enhanced-database.types'

interface User {
  id: string
  role: string
  company_id: string
}

type ThemeProgram = {
  id: string
  title: string
  description: string | null
  sort_order?: number
  course_type?: 'e-course' | 'physical-course'
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
  calculated_status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'locked' | 'pending' | null
  progress_percentage: number | null
  is_auto_assigned?: boolean
}

type UserProgressRow = {
  user_id: string
  program_id: string
  module_id: string
  status: string | null
}

type UserProgramStatus = {
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'locked' | 'pending'
  assignmentId: string
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
    badgeClass: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-200 dark:border-green-500/40',
    icon: <CheckCircle className="w-4 h-4" />
  },
  in_progress: {
    label: 'I gang',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/40',
    icon: <Clock className="w-4 h-4" />
  },
  overdue: {
    label: 'Forsinket',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-200 dark:border-red-500/40',
    icon: <AlertTriangle className="w-4 h-4" />
  },
  not_started: {
    label: 'Ikke startet',
    badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    icon: <Clock className="w-4 h-4" />
  },
  locked: {
    label: 'Låst',
    badgeClass: 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    icon: <Lock className="w-4 h-4" />
  },
  pending: {
    label: 'Venter',
    badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/40',
    icon: <PauseCircle className="w-4 h-4" />
  }
}

export default function InstructorProgramsPage() {
  const router = useRouter()
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<Record<string, ThemeProgressState>>({})

  useEffect(() => {
    fetchUserAndThemes()
  }, [])

  const fetchUserAndThemes = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Ikke innlogget')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', session.user.id)
        .single()

      if (!profile) {
        toast.error('Ikke autorisert')
        return
      }

      setUser(profile)
      await fetchThemes(profile.company_id, profile.id)
    } catch (error: any) {
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchThemes = async (companyId: string, instructorId: string) => {
    try {
      // Hent alle kurs instruktøren er tildelt
      const { data: instructorCourses, error: coursesError } = await supabase
        .from('training_programs')
        .select('id, theme_id')
        .eq('instructor_id', instructorId)
        .eq('company_id', companyId)

      if (coursesError) throw coursesError

      if (!instructorCourses || instructorCourses.length === 0) {
        setThemes([])
        return
      }

      // Hent unike theme_id-er (inkludert null for kurs uten tema)
      const themeIds = Array.from(new Set(
        instructorCourses
          .map(c => c.theme_id)
          .filter((id): id is string => id !== null)
      ))

      // Hent temaer
      let themesData: Theme[] = []
      if (themeIds.length > 0) {
        const { data: themesDataRaw, error: themesError } = await supabase
          .from('themes')
          .select('*')
          .in('id', themeIds)
          .eq('company_id', companyId)
          .order('created_at', { ascending: true })

        if (themesError) throw themesError
        themesData = themesDataRaw || []
      }

      // Hvis noen kurs ikke har tema, legg til "Uten program"
      const hasNoThemeCourses = instructorCourses.some(c => !c.theme_id)
      if (hasNoThemeCourses) {
        themesData.push({
          id: 'no-theme',
          name: 'Uten program',
          description: 'Kurs som ikke er knyttet til et program',
          company_id: companyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          order_index: 9999,
          progression_type: 'flexible'
        } as Theme)
      }

      setThemes(themesData)
    } catch (error: any) {
      console.error('Error fetching themes:', error)
      toast.error('Kunne ikke hente programmer')
    }
  }

  const handleToggleTheme = (themeId: string) => {
    if (expandedThemeId === themeId) {
      setExpandedThemeId(null)
    } else {
      setExpandedThemeId(themeId)
      // Hent progresjon når programmet utvides
      if (!progressState[themeId] || !progressState[themeId].data) {
        fetchThemeProgress(themeId)
      }
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
      const isNoTheme = themeId === 'no-theme'
      
      // Hent kurs i dette programmet som instruktøren er tildelt
      let programsQuery = supabase
        .from('training_programs')
        .select('id, title, description, sort_order, course_type')
        .eq('instructor_id', user.id)
        .eq('company_id', user.company_id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      
      if (isNoTheme) {
        programsQuery = programsQuery.is('theme_id', null)
      } else {
        programsQuery = programsQuery.eq('theme_id', themeId)
      }

      const { data: programsData, error: programsError } = await programsQuery

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

      // Hent moduler
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

      // Hent assignments
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('program_assignments')
        .select(
          'id, program_id, assigned_to_user_id, due_date, status, completed_at, assigned_at, notes, is_auto_assigned'
        )
        .in('program_id', programIds)
        .not('assigned_to_user_id', 'is', null)

      if (assignmentError) {
         throw assignmentError
      }
      
      const assignments: UserAssignmentView[] = (assignmentRows as any[]).map(row => ({
          ...row,
          user_id: row.assigned_to_user_id,
          calculated_status: row.status as any,
          is_auto_assigned: row.is_auto_assigned || false
      }))

      const userIds = Array.from(
        new Set(
          assignments
            .map((assignment) => assignment.user_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      // Hent profiler
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

      // Hent progress
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

      // Hent avdelinger
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

      // Finn hvilke avdelinger som tildelte kurs til hver bruker
      const { data: deptAssignmentsData } = await supabase
        .from('program_assignments')
        .select('program_id, assigned_to_department_id')
        .in('program_id', programIds)
        .not('assigned_to_department_id', 'is', null)

      const deptIds = Array.from(new Set(
        (deptAssignmentsData || [])
          .map(a => a.assigned_to_department_id)
          .filter((id): id is string => id !== null)
      ))

      const { data: userDeptsData } = await supabase
        .from('user_departments')
        .select('user_id, department_id')
        .in('user_id', userIds)
        .in('department_id', deptIds)

      const userAssignedDeptsMap = new Map<string, string[]>()
      if (userDeptsData) {
        userDeptsData.forEach(ud => {
          const deptName = departmentMap[ud.department_id]
          if (deptName) {
            const existing = userAssignedDeptsMap.get(ud.user_id) || []
            if (existing.indexOf(deptName) === -1) {
              existing.push(deptName)
            }
            userAssignedDeptsMap.set(ud.user_id, existing)
          }
        })
      }

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
          // Bestem avdeling
          let departmentName = 'Uten avdeling'
          if (assignment.is_auto_assigned) {
            const assignedDepts = userAssignedDeptsMap.get(userId) || []
            if (assignedDepts.length > 0) {
              departmentName = assignedDepts.join(', ')
            }
          } else {
            departmentName = 'Direkte tildelt'
          }

          userMap.set(userId, {
            userId,
            name: profile.full_name || 'Ukjent bruker',
            email: profile.email,
            departmentName,
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

        // Bestem status
        const rawStatus = assignment.status || 'not_started'
        let status: UserProgramStatus['status']
        
        if (rawStatus === 'locked' || rawStatus === 'pending') {
          status = rawStatus as UserProgramStatus['status']
        } else if (rawStatus === 'completed' || assignment.completed_at) {
          status = 'completed'
        } else {
          if (hasStarted) {
            status = 'in_progress'
          } else {
            status = 'not_started'
          }
          
          if (
            assignment.due_date &&
            new Date(assignment.due_date) < new Date()
          ) {
            status = 'overdue'
          }
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
          assignmentId: assignment.id,
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
      toast.error('Kunne ikke hente progresjon for programmet')

      setProgressState(prev => ({
        ...prev,
        [themeId]: {
          loading: false,
          error: 'Kunne ikke hente progresjon'
        }
      }))
    }
  }

  const handleConfirmPhysicalCourse = async (themeId: string, assignmentId: string) => {
    if (!confirm('Er du sikker på at du vil bekrefte at dette kurset er gjennomført?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('program_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId)

      if (error) throw error
      
      toast.success('Kurs bekreftet som gjennomført!')
      fetchThemeProgress(themeId)
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke bekrefte kurs: ' + error.message)
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mine kurs</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Oversikt over kurs du er instruktør for
          </p>
        </div>
      </div>

      {/* Programs List */}
      {themes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Ingen kurs ennå
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Du er ikke satt opp som instruktør for noen kurs ennå.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {themes.map((theme) => {
            const isExpanded = expandedThemeId === theme.id
            const progress = progressState[theme.id]

            return (
              <Card key={theme.id}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleTheme(theme.id)}
                      className="flex items-center space-x-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none flex-grow"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2">
                          {theme.name}
                          {theme.progression_type === 'sequential_auto' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                              Sekvensiell (Auto)
                            </span>
                          )}
                          {theme.progression_type === 'sequential_manual' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
                              Sekvensiell (Manuell)
                            </span>
                          )}
                        </span>
                        {theme.description && (
                          <span className="text-xs text-gray-500 font-normal">{theme.description}</span>
                        )}
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                      {progress?.loading ? (
                        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          Laster progresjon...
                        </div>
                      ) : progress?.error ? (
                        <div className="py-6 text-center text-sm text-red-600">
                          {progress.error}
                        </div>
                      ) : progress?.data ? (() => {
                        const data = progress.data
                        return data.programs.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Ingen kurs er knyttet til dette programmet.
                          </div>
                        ) : data.userRows.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Ingen brukere er tildelt kurs i dette programmet ennå.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="overflow-x-auto">
                              <table className="inline-table w-auto divide-y divide-gray-200">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                  <tr>
                                    <th className="w-40 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">
                                      Bruker
                                    </th>
                                    {data.programs.map((program, index) => (
                                      <th
                                        key={program.id}
                                        className="w-0 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[130px]"
                                      >
                                        <div className="flex flex-col items-center gap-1">
                                          <span>{index + 1}. {program.title}</span>
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                  {data.userRows.map((row) => (
                                    <tr key={row.userId}>
                                      <td className="w-40 px-2 py-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900 z-10">
                                        <div className="flex flex-col">
                                          <span>{row.name}</span>
                                          <span className="text-xs text-gray-500 font-normal">{row.departmentName}</span>
                                        </div>
                                      </td>
                                      {data.programs.map((program) => {
                                        const status = row.programs[program.id]
                                        const isPhysicalCourse = program.course_type === 'physical-course'

                                        if (!status) {
                                          return (
                                            <td key={`${row.userId}-${program.id}`} className="px-3 py-2 text-left align-middle min-w-[130px]">
                                              <span className="inline-flex items-center justify-start rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 whitespace-nowrap">
                                                Ikke tildelt
                                              </span>
                                            </td>
                                          )
                                        }

                                        const config = statusConfig[status.status]

                                        // For fysiske kurs, vis "Bekreft gjennomført" knapp hvis ikke allerede fullført
                                        if (isPhysicalCourse) {
                                          const isCompleted = status.status === 'completed'
                                          
                                          return (
                                            <td key={`${row.userId}-${program.id}`} className="px-3 py-2 text-center align-middle min-w-[130px]">
                                              {isCompleted ? (
                                                <span
                                                  className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.badgeClass}`}
                                                >
                                                  {config.icon}
                                                  <span>{config.label}</span>
                                                </span>
                                              ) : (
                                                <Button
                                                  size="sm"
                                                  onClick={() => handleConfirmPhysicalCourse(theme.id, status.assignmentId)}
                                                  className="bg-green-600 hover:bg-green-700 text-white border-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                                                >
                                                  <CheckCircle className="w-4 h-4 mr-2" />
                                                  Bekreft gjennomført
                                                </Button>
                                              )}
                                            </td>
                                          )
                                        }

                                        // For e-kurs, vis badge
                                        return (
                                          <td key={`${row.userId}-${program.id}`} className="px-3 py-2 text-left align-middle min-w-[130px]">
                                            <div className="flex items-center gap-2 justify-center">
                                              <span
                                                className={`inline-flex items-center justify-start gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.badgeClass}`}
                                              >
                                                {config.icon}
                                                <span>{config.label}</span>
                                              </span>
                                            </div>
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
          })}
        </div>
      )}
    </div>
  )
}
