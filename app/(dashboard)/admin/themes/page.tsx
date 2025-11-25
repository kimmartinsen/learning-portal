'use client'

import { useState, useEffect } from 'react'
import { Edit2, Trash2, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, Plus, Lock, PauseCircle, Unlock, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Theme } from '@/types/enhanced-database.types'
import { ThemeForm, type ThemeFormData } from '@/components/admin/programs/ThemeForm'
import { AssignmentSelector } from '@/components/admin/AssignmentSelector'

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
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<Record<string, ThemeProgressState>>({})
  
  // State for assigning theme to users/departments
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assigningTheme, setAssigningTheme] = useState<Theme | null>(null)
  const [assignSelection, setAssignSelection] = useState<{
    type: 'department' | 'individual'
    departmentIds: string[]
    userIds: string[]
  }>({
    type: 'department',
    departmentIds: [],
    userIds: []
  })
  const [assigning, setAssigning] = useState(false)
  
  const [formData, setFormData] = useState<ThemeFormData>({
    name: '',
    description: '',
    progression_type: 'flexible'
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

      let filteredThemes = themesData || []

      const { data: programThemeRows } = await supabase
        .from('training_programs')
        .select('theme_id')
        .eq('company_id', profile.company_id)

      if (programThemeRows) {
        const hasNoThemePrograms = programThemeRows.some(row => !row.theme_id)
        if (hasNoThemePrograms) {
          filteredThemes.push({
            id: 'no-theme',
            name: 'Uten program',
            description: 'Kurs som ikke er knyttet til et program',
            company_id: profile.company_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            order_index: 9999,
            progression_type: 'flexible'
          } as Theme)
        }
      }

      setThemes(filteredThemes)
    } catch (error: any) {
      toast.error('Kunne ikke hente programmer: ' + error.message)
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
            progression_type: formData.progression_type
          })
          .eq('id', editingTheme.id)

        if (error) throw error
        toast.success('Program oppdatert!')
      } else {
        // Create new theme
        const { error } = await supabase
          .from('themes')
          .insert([{
            name: formData.name,
            description: formData.description || null,
            company_id: user.company_id,
            progression_type: formData.progression_type
          }])

        if (error) throw error
        toast.success('Program opprettet!')
      }

      setShowForm(false)
      setEditingTheme(null)
      setFormData({ name: '', description: '', progression_type: 'flexible' })
      fetchUserAndThemes()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleCreate = () => {
    setEditingTheme(null)
    setFormData({
      name: '',
      description: '',
      progression_type: 'flexible'
    })
    setShowForm(true)
  }

  const handleEdit = (theme: Theme) => {
    setEditingTheme(theme)
    setFormData({
      name: theme.name,
      description: theme.description || '',
      progression_type: theme.progression_type || 'flexible'
    })
    setShowForm(true)
  }

  const handleDelete = async (themeId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette programmet? Alle tilhørende kurs vil miste program-tilknytningen.')) return

    try {
      const { error } = await supabase
        .from('themes')
        .delete()
        .eq('id', themeId)

      if (error) throw error
      toast.success('Program slettet!')
      fetchUserAndThemes()
    } catch (error: any) {
      toast.error('Kunne ikke slette program: ' + error.message)
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
      
      // Refresh progress data
      fetchThemeProgress(themeId)
    } catch (error: any) {
      toast.error('Kunne ikke låse opp kurs: ' + error.message)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTheme(null)
    setFormData({ name: '', description: '', progression_type: 'flexible' })
  }

  // --- New: Assignment Handling ---

  const handleOpenAssign = (theme: Theme) => {
    setAssigningTheme(theme)
    setAssignSelection({
      type: 'department',
      departmentIds: [],
      userIds: []
    })
    setShowAssignModal(true)
  }

  const handleAssignSubmit = async () => {
    if (!assigningTheme || !user) return
    
    setAssigning(true)
    try {
      // 1. Get all programs in this theme
      const { data: programs } = await supabase
        .from('training_programs')
        .select('id, sort_order')
        .eq('theme_id', assigningTheme.id)
        .order('sort_order', { ascending: true })
      
      if (!programs || programs.length === 0) {
        toast.error('Ingen kurs i dette programmet å tildele')
        return
      }

      let successCount = 0
      let allAssignedUserIds: string[] = []

      // 2. Loop through programs and assign them
      // Important: If sequential, status will be handled by database triggers/logic or here?
      // For now, we assign all, but for sequential programs, we might want to set status based on order?
      // Actually, the simplest is to assign ALL, but the 'sort_order' logic in 'My Learning' page
      // and 'handle_course_completion' trigger handles the locking.
      // BUT: We need to set initial status correctly.
      // Flexible: All 'assigned'
      // Sequential: First 'assigned', rest 'locked'
      
      const isSequential = assigningTheme.progression_type === 'sequential_auto' || assigningTheme.progression_type === 'sequential_manual'
      
      // Group assignments by program to handle them
      for (let index = 0; index < programs.length; index++) {
        const program = programs[index]
        const isFirst = index === 0
        // If sequential, only the first program is 'assigned', others are 'locked'
        // BUT: Our 'assign_program_to_user' RPC doesn't support custom status yet.
        // We might need to call it and then update status, or update the RPC.
        // For simplicity/speed now: Assign normally, then update status if sequential and not first.
        
        // Actually, let's just call the existing RPCs. They create assignments with default 'assigned'.
        // Then we bulk update them to 'locked' if needed.
        
        const programId = program.id
        
        // Assign to departments
        if (assignSelection.type === 'department' && assignSelection.departmentIds.length > 0) {
          for (const deptId of assignSelection.departmentIds) {
             // 1. Get users in dept
             const { data: deptUsers } = await supabase
                .from('user_departments')
                .select('user_id')
                .eq('department_id', deptId)
             
             if (deptUsers) {
               allAssignedUserIds.push(...deptUsers.map(u => u.user_id))
             }

             // 2. Create dept assignment
             const { error } = await supabase.rpc('assign_program_to_department', {
                p_program_id: programId,
                p_department_id: deptId,
                p_assigned_by: user.id,
                p_notes: 'Del av program-tildeling: ' + assigningTheme.name
             })
             if (!error) successCount++
          }
        }
        
        // Assign to individuals
        if (assignSelection.type === 'individual' && assignSelection.userIds.length > 0) {
          allAssignedUserIds.push(...assignSelection.userIds)
          for (const userId of assignSelection.userIds) {
             const { error } = await supabase.rpc('assign_program_to_user', {
                p_program_id: programId,
                p_user_id: userId,
                p_assigned_by: user.id,
                p_notes: 'Del av program-tildeling: ' + assigningTheme.name
             })
             if (!error) successCount++
          }
        }
      }
      
      // 3. If sequential, lock non-first programs
      if (isSequential && programs.length > 1) {
        const programsToLock = programs.slice(1).map(p => p.id)
        if (programsToLock.length > 0 && allAssignedUserIds.length > 0) {
           // Update status to 'locked' for these programs and users
           // Note: This is a bit rough, as it might lock already completed courses if re-assigned.
           // Ideally we only lock NEW assignments.
           // 'assign_program_to_user' does nothing if already exists.
           // So we should only update if status is 'assigned' and progress is 0?
           
           await supabase
             .from('program_assignments')
             .update({ status: 'locked' })
             .in('program_id', programsToLock)
             .in('assigned_to_user_id', allAssignedUserIds)
             .eq('status', 'assigned') // Only lock if currently just assigned (not started/completed)
        }
      }

      if (successCount > 0) {
        toast.success('Program tildelt!')
        // Refresh data
        if (expandedThemeId === assigningTheme.id) {
          fetchThemeProgress(assigningTheme.id)
        }
      } else {
        toast.info('Ingen nye tildelinger ble opprettet (kanskje de allerede eksisterte?)')
      }
      
      setShowAssignModal(false)
      setAssigningTheme(null)
    } catch (error: any) {
      console.error('Error assigning program:', error)
      toast.error('Feil under tildeling: ' + error.message)
    } finally {
      setAssigning(false)
    }
  }

  // --- End Assignment Handling ---

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Programoversikt</h1>
          <p className="text-gray-600 dark:text-gray-300">Administrer programmer og se deltakernes progresjon</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nytt program
        </Button>
      </div>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={resetForm}>
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingTheme ? 'Rediger program' : 'Nytt program'}
            </h3>
          </CardHeader>
          <CardContent>
            <ThemeForm
              formData={formData}
              isCreating={!editingTheme}
              onSubmit={handleSubmit}
              onChange={(data) => setFormData(prev => ({ ...prev, ...data }))}
              onCancel={resetForm}
              buttonText={editingTheme ? 'Oppdater program' : 'Opprett program'}
            />
          </CardContent>
        </Card>
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)}>
        <Card className="w-full max-w-lg bg-white dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tildel program: {assigningTheme?.name}
            </h3>
            <p className="text-sm text-gray-500">
              Dette vil tildele alle kursene i programmet til de valgte mottakerne.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssignmentSelector
              companyId={user?.company_id || ''}
              onSelectionChange={setAssignSelection}
              selection={assignSelection}
            />
            
            <div className="flex space-x-3 pt-4">
              <Button 
                className="flex-1" 
                onClick={handleAssignSubmit} 
                loading={assigning}
                disabled={assignSelection.departmentIds.length === 0 && assignSelection.userIds.length === 0}
              >
                Tildel program
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setShowAssignModal(false)} 
                disabled={assigning}
              >
                Avbryt
              </Button>
            </div>
          </CardContent>
        </Card>
      </Modal>

      {/* Themes List */}
      <div className="grid gap-4">
        {themes.length > 0 ? (
          themes.map((theme) => {
            const isExpanded = expandedThemeId === theme.id
            const progress = progressState[theme.id]
            const isNoTheme = theme.id === 'no-theme'

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
                    
                    {!isNoTheme && (
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssign(theme)}
                          className="mr-2 h-8 text-xs"
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Tildel
                        </Button>
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
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
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
                                        const isLockedOrPending = status.status === 'locked' || status.status === 'pending'

                                        return (
                                          <td key={`${row.userId}-${program.id}`} className="px-3 py-2 text-left align-middle min-w-[130px]">
                                            <div className="flex items-center gap-2 justify-center">
                                              <span
                                                className={`inline-flex items-center justify-start gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.badgeClass}`}
                                              >
                                                {config.icon}
                                                <span>{config.label}</span>
                                              </span>
                                              
                                              {isLockedOrPending && (
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 text-gray-500 hover:text-blue-600"
                                                  title="Lås opp kurs"
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
                Opprett et program for å komme i gang.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Opprett program
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
