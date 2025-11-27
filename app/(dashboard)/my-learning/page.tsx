import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { Button } from '@/components/ui/Button'
import {
  BookOpen,
  Clock,
  PlayCircle,
  CheckCircle,
  AlertTriangle,
  Tag,
  ChevronRight,
  Lock,
  PauseCircle
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FocusRefresher } from '@/components/utils/FocusRefresher'
import { UserChangeDetector } from '@/components/utils/UserChangeDetector'

interface UserAssignment {
  id: string
  program_id: string
  user_id: string
  due_date: string
  status: string
  completed_at: string | null
  notes: string | null
  is_auto_assigned: boolean
  assigned_at: string
  program_title: string
  program_description: string | null
  deadline_days: number
  theme_name: string | null
  days_remaining: number
  calculated_status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'locked' | 'pending'
  progress_percentage: number
  sort_order?: number
  course_type?: 'e-course' | 'physical-course'
  is_instructor?: boolean
}

export default async function MyLearningPage({
  searchParams
}: {
  searchParams: { error?: string }
}) {
  const supabase = createServerSupabaseClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  
  const showLockedError = searchParams.error === 'locked'

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, company_id, department_id, full_name')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get user's assignments using the view - force fresh data
  // Use cache: 'no-store' to prevent caching between different users
  console.log(`[${new Date().toISOString()}] Fetching assignments for user:`, profile.id)
  
  const { data: assignmentsData, error } = await supabase
    .from('user_assignments')
    .select('*')
    .eq('user_id', profile.id)
  
  console.log(`[${new Date().toISOString()}] Fetched ${assignmentsData?.length || 0} assignments for user ${profile.id}`)
  
  if (error) {
    console.error('Error fetching assignments:', error)
  }

  // Get sort_order, course_type, and instructor_id for programs to sort them correctly within themes
  const { data: programsData } = await supabase
    .from('training_programs')
    .select('id, sort_order, course_type, instructor_id')
    .in('id', (assignmentsData || []).map(a => a.program_id))

  const sortOrderMap = new Map(
    (programsData || []).map(p => [p.id, p.sort_order || 0])
  )
  
  const courseTypeMap = new Map(
    (programsData || []).map(p => [p.id, p.course_type || 'e-course'])
  )
  
  const instructorMap = new Map(
    (programsData || []).map(p => [p.id, p.instructor_id === profile.id])
  )

  // Process assignments to include proper status and sort order
  const assignments: UserAssignment[] = (assignmentsData || []).map((a: any) => {
    // Override calculated_status if the raw status is locked or pending
    let status = a.calculated_status
    if (a.status === 'locked') status = 'locked'
    if (a.status === 'pending') status = 'pending'

    return {
      ...a,
      calculated_status: status,
      sort_order: sortOrderMap.get(a.program_id) || 0,
      course_type: courseTypeMap.get(a.program_id) || 'e-course',
      is_instructor: instructorMap.get(a.program_id) || false
    }
  })

  // Sort assignments by sort_order then days remaining
  assignments.sort((a, b) => {
    // First by days remaining (priority)
    // But wait, user probably wants to see them in sequence order if it's a program?
    // Let's prioritize sequence if they belong to the same theme.
    // But we group by theme anyway.
    return a.days_remaining - b.days_remaining
  })

  // Group assignments by status
  const notStarted = assignments.filter(a => a.calculated_status === 'not_started')
  const inProgress = assignments.filter(a => a.calculated_status === 'in_progress')
  const completed = assignments.filter(a => a.calculated_status === 'completed')
  const overdue = assignments.filter(a => a.calculated_status === 'overdue')

  // Group by theme for better organization
  const assignmentsByTheme = assignments.reduce((acc, assignment) => {
    const theme = assignment.theme_name || 'Uten program'
    if (!acc[theme]) {
      acc[theme] = []
    }
    acc[theme].push(assignment)
    return acc
  }, {} as Record<string, UserAssignment[]>) || {}

  // Sort assignments within themes by sort_order
  Object.keys(assignmentsByTheme).forEach(theme => {
    assignmentsByTheme[theme].sort((a, b) => {
      // If same sort order (or 0), sort by created/deadline
      if ((a.sort_order || 0) !== (b.sort_order || 0)) {
        return (a.sort_order || 0) - (b.sort_order || 0)
      }
      return a.days_remaining - b.days_remaining
    })
  })

  const getThemeAssignments = (themeName: string): UserAssignment[] => {
    return assignmentsByTheme[themeName] || []
  }

  const getStatusColor = (status: string) => {
     switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-500/20 dark:border-green-500/40'
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-200 dark:bg-blue-500/20 dark:border-blue-500/40'
      case 'overdue':
        return 'text-red-600 bg-red-50 border-red-200 dark:text-red-200 dark:bg-red-500/20 dark:border-red-500/40'
      case 'locked':
        return 'text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-200 dark:bg-yellow-500/20 dark:border-yellow-500/40'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Fullført'
      case 'in_progress': return 'I gang'
      case 'overdue': return 'Forsinket'
      case 'locked': return 'Låst'
      case 'pending': return 'Venter'
      default: return 'Ikke startet'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <PlayCircle className="w-4 h-4" />
      case 'overdue': return <AlertTriangle className="w-4 h-4" />
      case 'locked': return <Lock className="w-4 h-4" />
      case 'pending': return <PauseCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const formatDaysRemaining = (days: number, status: string) => {
    if (status === 'completed') return 'Fullført'
    if (status === 'locked') return 'Låst'
    if (status === 'pending') return 'Venter på godkjenning'
    if (days < 0) return `${Math.abs(days)} dager forsinket`
    if (days === 0) return 'Frist i dag'
    if (days === 1) return 'Frist i morgen'
    return `${days} dager igjen`
  }

  return (
    <div className="space-y-6">
      <UserChangeDetector />
      <FocusRefresher />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Min opplæring</h1>
        <p className="text-gray-600 dark:text-gray-300">Oversikt over dine personlige kursoppdrag</p>
      </div>

      {/* Locked Course Alert */}
      {showLockedError && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-500/40 dark:bg-yellow-900/20">
          <CardContent className="p-4 text-yellow-800 dark:text-yellow-200">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />
              <span className="font-medium">
                Dette kurset er låst. Du må fullføre tidligere kurs først.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Alert for Overdue */}
      {overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-900/20">
          <CardContent className="p-4 text-red-800 dark:text-red-200">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-300" />
              <span className="font-medium">
                Du har {overdue.length} forsinkede kurs som trenger oppmerksomhet
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments List - Grouped by Theme */}
      <div className="space-y-4">
        {Object.entries(assignmentsByTheme).map(([themeName]) => {
          const themeAssignments = getThemeAssignments(themeName)
          return (
            <details
              key={themeName}
              className="group rounded-lg border border-gray-200 bg-white shadow-sm dark:bg-gray-900 dark:border-gray-800 transition-colors duration-200"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-200 group-open:rotate-90" />
                  <Tag className="h-4 w-4 text-primary-600" />
                  <span className="text-base font-semibold">{themeName}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({themeAssignments.length} kurs)</span>
                </div>
              </summary>

              <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4">
                {themeAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ingen kurs i dette programmet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {themeAssignments.map((assignment, index) => {
                      const status = assignment.calculated_status
                      const isLocked = status === 'locked' || status === 'pending'
                      const isPhysicalCourse = assignment.course_type === 'physical-course'
                      const isInstructor = assignment.is_instructor || false

                      // For fysiske kurs eller instruktører, ikke vis action knapp
                      if (isPhysicalCourse || isInstructor) {
                        return (
                          <Card
                            key={assignment.id}
                            className={
                              status === 'completed'
                                ? 'border-green-200 dark:border-green-500/40 shadow-sm'
                                : 'shadow-sm'
                            }
                          >
                            <CardContent className="space-y-4 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col">
                                  {themeName !== 'Uten program' && (
                                    <span className="text-xs text-gray-500 mb-1">Steg {(assignment.sort_order != null && assignment.sort_order >= 0) ? assignment.sort_order + 1 : index + 1}</span>
                                  )}
                                  <h3 className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                                    {assignment.program_title}
                                  </h3>
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(
                                    status
                                  )}`}
                                >
                                  {getStatusIcon(status)}
                                  <span>{getStatusText(status)}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Clock className="h-4 w-4" />
                                <span>{formatDaysRemaining(assignment.days_remaining, status)}</span>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      }

                      const actionConfig =
                        status === 'completed'
                          ? {
                              label: 'Se igjen',
                              icon: <CheckCircle className="w-4 h-4" />,
                              variant: 'secondary' as const,
                              disabled: false
                            }
                          : status === 'in_progress'
                          ? {
                              label: 'Fortsett',
                              icon: <PlayCircle className="w-4 h-4" />,
                              variant: 'primary' as const,
                              disabled: false
                            }
                          : status === 'overdue'
                          ? {
                              label: 'Start nå',
                              icon: <AlertTriangle className="w-4 h-4" />,
                              variant: 'danger' as const,
                              disabled: false
                            }
                          : status === 'locked'
                          ? {
                              label: 'Låst',
                              icon: <Lock className="w-4 h-4" />,
                              variant: 'secondary' as const,
                              disabled: true
                            }
                          : status === 'pending'
                          ? {
                              label: 'Venter',
                              icon: <PauseCircle className="w-4 h-4" />,
                              variant: 'secondary' as const,
                              disabled: true
                            }
                          : {
                              label: 'Start',
                              icon: <PlayCircle className="w-4 h-4" />,
                              variant: 'primary' as const,
                              disabled: false
                            }

                      return (
                        <Card
                          key={assignment.id}
                          className={
                            status === 'overdue'
                              ? 'border-red-200 dark:border-red-500/40 shadow-sm'
                              : status === 'completed'
                              ? 'border-green-200 dark:border-green-500/40 shadow-sm'
                              : isLocked 
                              ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-75'
                              : 'shadow-sm'
                          }
                        >
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col">
                                {themeName !== 'Uten program' && (
                                  <span className="text-xs text-gray-500 mb-1">Steg {(assignment.sort_order != null && assignment.sort_order >= 0) ? assignment.sort_order + 1 : index + 1}</span>
                                )}
                                <h3 className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                                  {assignment.program_title}
                                </h3>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(
                                  status
                                )}`}
                              >
                                {getStatusIcon(status)}
                                <span>{getStatusText(status)}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="h-4 w-4" />
                              <span>{formatDaysRemaining(assignment.days_remaining, status)}</span>
                            </div>

                            {isLocked ? (
                              <Button
                                size="sm"
                                variant={actionConfig.variant}
                                className="flex w-full items-center justify-center gap-2 cursor-not-allowed opacity-70"
                                disabled
                              >
                                {actionConfig.icon}
                                <span>{actionConfig.label}</span>
                              </Button>
                            ) : (
                              <Link href={`/programs/${assignment.program_id}`} className="block">
                                <Button
                                  size="sm"
                                  variant={actionConfig.variant}
                                  className="flex w-full items-center justify-center gap-2"
                                >
                                  {actionConfig.icon}
                                  <span>{actionConfig.label}</span>
                                </Button>
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </details>
          )
        })}

        {assignments?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Ingen kurs ennå
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Du har ikke blitt tildelt noen kurs ennå. 
                Kontakt din administrator for mer informasjon.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
