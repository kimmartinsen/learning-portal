'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, Lock, PauseCircle, Unlock, ClipboardCheck, GraduationCap, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Theme } from '@/types/enhanced-database.types'
import type { Checklist, ChecklistItem, ChecklistItemStatus } from '@/types/checklist.types'
import Link from 'next/link'

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

export default function ThemesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'programs' | 'checklists'>('programs')
  const [themes, setThemes] = useState<Theme[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null)
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<Record<string, ThemeProgressState>>({})
  const [checklistProgressState, setChecklistProgressState] = useState<Record<string, {
    loading: boolean
    data?: {
      items: ChecklistItem[]
      userRows: Array<{
        userId: string
        name: string
        email: string | null
        departmentName: string
        items: Record<string, { status: string; itemStatusId?: string; assignmentId: string }>
      }>
    }
    error?: string
  }>>({})
  
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
      await Promise.all([
        fetchThemes(profile.company_id),
        fetchChecklists(profile.company_id)
      ])
    } catch (error: any) {
      toast.error('Kunne ikke hente programmer: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchThemes = async (companyId: string) => {
    try {
      const { data: themesData, error } = await supabase
        .from('themes')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

      if (error) throw error

      let filteredThemes = themesData || []

      const { data: programThemeRows } = await supabase
        .from('training_programs')
        .select('theme_id')
        .eq('company_id', companyId)

      if (programThemeRows) {
        const hasNoThemePrograms = programThemeRows.some(row => !row.theme_id)
        if (hasNoThemePrograms) {
          filteredThemes.push({
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
      }

      setThemes(filteredThemes)
    } catch (error: any) {
      console.error('Error fetching themes:', error)
      toast.error('Kunne ikke hente programmer')
    }
  }

  const fetchChecklists = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setChecklists(data || [])
    } catch (error: any) {
      console.error('Error fetching checklists:', error)
      // Don't show error toast for checklists as they might not exist yet
    }
  }

  const handleUnlock = async (assignmentId: string, themeId: string) => {
    try {
      const { error } = await supabase
        .from('program_assignments')
        .update({ status: 'assigned', assigned_at: new Date().toISOString() }) // Set to assigned to unlock
        .eq('id', assignmentId)
      
      if (error) throw error
      
      toast.success('Kurs låst opp')
      
      // Refresh progress data for this theme
      fetchThemeProgress(themeId)
      
      // VIKTIG: Trigger refresh av alle Server Components (inkludert Min opplæring)
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke låse opp kurs: ' + error.message)
    }
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

  const handleToggleChecklist = (checklistId: string) => {
    if (expandedChecklistId === checklistId) {
      setExpandedChecklistId(null)
      return
    }

    setExpandedChecklistId(checklistId)

    if (!checklistProgressState[checklistId]) {
      fetchChecklistProgress(checklistId)
    }
  }

  const fetchChecklistProgress = async (checklistId: string) => {
    if (!user) {
      toast.error('Kunne ikke hente brukerdata')
      return
    }

    setChecklistProgressState(prev => ({
      ...prev,
      [checklistId]: { loading: true }
    }))

    try {
      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', checklistId)
        .order('order_index', { ascending: true })

      if (itemsError) throw itemsError
      const items = (itemsData as ChecklistItem[] | null) || []

      if (items.length === 0) {
        setChecklistProgressState(prev => ({
          ...prev,
          [checklistId]: {
            loading: false,
            data: {
              items: [],
              userRows: []
            }
          }
        }))
        return
      }

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('checklist_assignments')
        .select(`
          *,
          assigned_to_user:profiles!checklist_assignments_assigned_to_user_id_fkey(id, full_name, email)
        `)
        .eq('checklist_id', checklistId)

      if (assignmentsError) throw assignmentsError

      const assignments = (assignmentsData || []).map(a => ({
        ...a,
        assigned_to_user: Array.isArray(a.assigned_to_user) ? a.assigned_to_user[0] : a.assigned_to_user
      }))

      if (assignments.length === 0) {
        setChecklistProgressState(prev => ({
          ...prev,
          [checklistId]: {
            loading: false,
            data: {
              items,
              userRows: []
            }
          }
        }))
        return
      }

      // Fetch item statuses for all assignments
      const assignmentIds = assignments.map(a => a.id)
      const { data: itemStatusesData, error: itemStatusesError } = await supabase
        .from('checklist_item_status')
        .select('*')
        .in('assignment_id', assignmentIds)

      if (itemStatusesError) throw itemStatusesError
      const itemStatuses = (itemStatusesData as ChecklistItemStatus[] | null) || []

      // Get user departments
      const userIds = assignments.map(a => a.assigned_to_user_id)
      const { data: userDeptsData } = await supabase
        .from('user_departments')
        .select(`
          user_id,
          departments(name)
        `)
        .in('user_id', userIds)

      const userDeptsMap = new Map<string, string>()
      if (userDeptsData) {
        userDeptsData.forEach(ud => {
          const deptName = Array.isArray(ud.departments) && ud.departments.length > 0
            ? ud.departments[0].name
            : 'Ingen avdeling'
          userDeptsMap.set(ud.user_id, deptName)
        })
      }

      // Build user rows
      const userRows = assignments.map(assignment => {
        const user = assignment.assigned_to_user
        const itemsMap: Record<string, { status: string; itemStatusId?: string; assignmentId: string }> = {}

        items.forEach(item => {
          const status = itemStatuses.find(
            s => s.assignment_id === assignment.id && s.item_id === item.id
          )
          itemsMap[item.id] = {
            status: status?.status || 'not_started',
            itemStatusId: status?.id,
            assignmentId: assignment.id
          }
        })

        return {
          userId: assignment.assigned_to_user_id,
          name: user?.full_name || 'Ukjent bruker',
          email: user?.email || null,
          departmentName: userDeptsMap.get(assignment.assigned_to_user_id) || 'Ingen avdeling',
          items: itemsMap
        }
      }).sort((a, b) => a.name.localeCompare(b.name))

      setChecklistProgressState(prev => ({
        ...prev,
        [checklistId]: {
          loading: false,
          data: {
            items,
            userRows
          }
        }
      }))
    } catch (error: any) {
      console.error('Error fetching checklist progress:', error)
      toast.error('Kunne ikke hente progresjon for sjekklisten')

      setChecklistProgressState(prev => ({
        ...prev,
        [checklistId]: {
          loading: false,
          error: 'Kunne ikke hente progresjon'
        }
      }))
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
      
      let programsQuery = supabase
        .from('training_programs')
        .select('id, title, description, sort_order')
        // Hvis vi har sort_order, bruk den. Ellers created_at.
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
        .from('program_assignments')
        .select(
          'id, program_id, assigned_to_user_id, due_date, status, completed_at, assigned_at, notes'
        )
        .in('program_id', programIds)
        .not('assigned_to_user_id', 'is', null)

      if (assignmentError) {
         throw assignmentError
      }
      
      // Vi må mappe resultatet til UserAssignmentView strukturen
      const assignments: UserAssignmentView[] = (assignmentRows as any[]).map(row => ({
          ...row,
          user_id: row.assigned_to_user_id,
          calculated_status: row.status as any
      }))

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

        // Håndter assignment status - kan være locked, pending, assigned, started, completed, etc.
        const rawStatus = assignment.status || 'not_started'
        let status: UserProgramStatus['status']
        
        // Hvis status er locked eller pending, bruk den direkte
        if (rawStatus === 'locked' || rawStatus === 'pending') {
          status = rawStatus as UserProgramStatus['status']
        } else if (rawStatus === 'completed' || assignment.completed_at) {
          status = 'completed'
        } else {
          // For assigned, started, not_started - beregn status basert på fremdrift
          if (hasStarted) {
            status = 'in_progress'
          } else {
            status = 'not_started'
          }
          
          // Sjekk forsinkelse (bare for in_progress eller not_started)
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
          assignmentId: assignment.id, // Viktig for unlock
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

  if (loading) {
    return <div className="text-center py-8">Laster...</div>
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-500/20 dark:border-green-500/40'
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-200 dark:bg-blue-500/20 dark:border-blue-500/40'
      case 'cancelled':
        return 'text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Fullført'
      case 'in_progress':
        return 'I gang'
      case 'cancelled':
        return 'Avbrutt'
      default:
        return 'Ikke startet'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Oversikt</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {activeTab === 'programs' ? 'Status og progresjon for alle programmer' : 'Oversikt over alle sjekklister'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('programs')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'programs'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <GraduationCap className="h-4 w-4" />
            Kursprogram
          </button>
          <button
            onClick={() => setActiveTab('checklists')}
            className={`
              flex items-center gap-2 border-b-2 py-4 px-1 text-sm font-medium transition-colors
              ${activeTab === 'checklists'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <ClipboardCheck className="h-4 w-4" />
            Sjekklister
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'checklists' ? (
        /* Checklists View - Same structure as Programs */
        <div className="grid gap-4">
          {checklists.length > 0 ? (
            checklists.map((checklist) => {
              const isExpanded = expandedChecklistId === checklist.id
              const progress = checklistProgressState[checklist.id]

              return (
                <Card key={checklist.id}>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(checklist.id)}
                        className="flex items-center space-x-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none flex-grow"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-primary-600" />
                            {checklist.title}
                          </span>
                          <span className="text-xs text-gray-500 font-normal">{checklist.description}</span>
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
                          return data.items.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                              Ingen punkter er lagt til i denne sjekklisten.
                            </div>
                          ) : data.userRows.length === 0 ? (
                            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                              Ingen brukere er tildelt denne sjekklisten ennå.
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
                                      {data.items.map((item, index) => (
                                        <th
                                          key={item.id}
                                          className="w-0 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[130px]"
                                        >
                                          <div className="flex flex-col items-center gap-1">
                                            <span>{index + 1}. {item.title}</span>
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
                                        {data.items.map((item) => {
                                          const itemStatus = row.items[item.id]
                                          const status = itemStatus?.status || 'not_started'
                                          const assignmentId = itemStatus?.assignmentId

                                          const handleStatusChange = async (newStatus: string) => {
                                            if (!assignmentId) return

                                            try {
                                              const { data: { session } } = await supabase.auth.getSession()
                                              
                                              const updateData: any = {
                                                status: newStatus,
                                                updated_at: new Date().toISOString()
                                              }

                                              if (newStatus === 'completed') {
                                                updateData.completed_at = new Date().toISOString()
                                                updateData.completed_by = session?.user.id || null
                                              } else {
                                                updateData.completed_at = null
                                                updateData.completed_by = null
                                              }

                                              if (itemStatus?.itemStatusId) {
                                                const { error } = await supabase
                                                  .from('checklist_item_status')
                                                  .update(updateData)
                                                  .eq('id', itemStatus.itemStatusId)

                                                if (error) throw error
                                              } else {
                                                const { error } = await supabase
                                                  .from('checklist_item_status')
                                                  .insert([{
                                                    assignment_id: assignmentId,
                                                    item_id: item.id,
                                                    ...updateData
                                                  }])

                                                if (error) throw error
                                              }
                                              
                                              toast.success('Status oppdatert!')
                                              fetchChecklistProgress(checklist.id)
                                              router.refresh()
                                            } catch (error: any) {
                                              toast.error('Kunne ikke oppdatere status: ' + error.message)
                                            }
                                          }

                                          const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_started

                                          return (
                                            <td key={`${row.userId}-${item.id}`} className="px-3 py-2 text-center align-middle min-w-[130px]">
                                              <select
                                                value={status}
                                                onChange={(e) => handleStatusChange(e.target.value)}
                                                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <option value="not_started">Ikke startet</option>
                                                <option value="in_progress">I gang</option>
                                                <option value="completed">Fullført</option>
                                                <option value="cancelled">Avbrutt</option>
                                              </select>
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
                <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Ingen sjekklister ennå
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Gå til "Sjekklister" for å opprette din første sjekkliste.
                </p>
                <Link href="/admin/checklists">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Opprett sjekkliste
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Programs View */
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
                        <span className="text-xs text-gray-500 font-normal">{theme.description}</span>
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
                                          {/* Kan vise sorting index her hvis aktuelt */}
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
                                        const isPending = status.status === 'pending'

                                        return (
                                          <td key={`${row.userId}-${program.id}`} className="px-3 py-2 text-left align-middle min-w-[130px]">
                                            <div className="flex items-center gap-2 justify-center">
                                              <span
                                                className={`inline-flex items-center justify-start gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.badgeClass}`}
                                              >
                                                {config.icon}
                                                <span>{config.label}</span>
                                              </span>
                                              
                                              {isPending && (
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                                                  title="Godkjenn og lås opp kurs"
                                                  onClick={() => handleUnlock(status.assignmentId, theme.id)}
                                                >
                                                  <Unlock className="h-3 w-3" />
                                                </Button>
                                              )}
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
          })
        ) : (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Ingen programmer ennå
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Gå til "Kurs" for å opprette ditt første program.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      )}
    </div>
  )
}
