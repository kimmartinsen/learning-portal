import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BookOpen, Clock, PlayCircle, CheckCircle, AlertTriangle, Tag } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
  calculated_status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  progress_percentage: number
}

export default async function MyLearningPage() {
  const supabase = createServerSupabaseClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, company_id, department_id, full_name')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get user's assignments using the view
  const { data: assignments, error } = await supabase
    .from('user_assignments')
    .select('*')
    .eq('user_id', profile.id)
    .order('days_remaining', { ascending: true }) // Priority: expiring soon first

  if (error) {
    console.error('Error fetching assignments:', error)
  }

  // Progress calculation no longer needs badges
  const badgeMap = new Map()

  // Group assignments by status
  const notStarted = assignments?.filter(a => a.calculated_status === 'not_started') || []
  const inProgress = assignments?.filter(a => a.calculated_status === 'in_progress') || []
  const completed = assignments?.filter(a => a.calculated_status === 'completed') || []
  const overdue = assignments?.filter(a => a.calculated_status === 'overdue') || []

  // Group by theme for better organization
  const assignmentsByTheme = assignments?.reduce((acc, assignment) => {
    const theme = assignment.theme_name || 'Uten tema'
    if (!acc[theme]) {
      acc[theme] = []
    }
    acc[theme].push(assignment)
    return acc
  }, {} as Record<string, UserAssignment[]>) || {}

  // Type guard to ensure themeAssignments is properly typed
  const getThemeAssignments = (themeName: string): UserAssignment[] => {
    return assignmentsByTheme[themeName] || []
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200'
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'overdue': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Fullført'
      case 'in_progress': return 'I gang'
      case 'overdue': return 'Forsinket'
      default: return 'Ikke startet'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <PlayCircle className="w-4 h-4" />
      case 'overdue': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const formatDaysRemaining = (days: number, status: string) => {
    if (status === 'completed') return 'Fullført'
    if (days < 0) return `${Math.abs(days)} dager forsinket`
    if (days === 0) return 'Frist i dag'
    if (days === 1) return 'Frist i morgen'
    return `${days} dager igjen`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Min opplæring</h1>
        <p className="text-gray-600">Oversikt over dine personlige kursoppdrag</p>
      </div>

      {/* Priority Alert for Overdue */}
      {overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">
                Du har {overdue.length} forsinkede kurs som trenger oppmerksomhet
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignments List - Grouped by Theme */}
      <div className="space-y-6">
        {Object.entries(assignmentsByTheme).map(([themeName]) => {
          const themeAssignments = getThemeAssignments(themeName)
          return (
            <div key={themeName} className="space-y-3">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">{themeName}</h2>
                <span className="text-sm text-gray-500">({themeAssignments.length} kurs)</span>
              </div>
              
              <div className="overflow-x-auto ml-7">
                <table className="inline-table w-auto divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-36 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                        Kurs
                      </th>
                      {themeAssignments.map((assignment) => (
                        <th
                          key={`${assignment.id}-header`}
                          className="w-0 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap"
                        >
                          {assignment.program_title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr>
                      <td className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Status
                      </td>
                      {themeAssignments.map((assignment) => {
                        const status = assignment.calculated_status

                        const actionConfig =
                          status === 'completed'
                            ? {
                                label: 'Se igjen',
                                icon: <CheckCircle className="w-4 h-4" />,
                                variant: 'secondary' as const
                              }
                            : status === 'in_progress'
                            ? {
                                label: 'Fortsett',
                                icon: <PlayCircle className="w-4 h-4" />,
                                variant: 'primary' as const
                              }
                            : status === 'overdue'
                            ? {
                                label: 'Start nå',
                                icon: <AlertTriangle className="w-4 h-4" />,
                                variant: 'danger' as const
                              }
                            : {
                                label: 'Start',
                                icon: <PlayCircle className="w-4 h-4" />,
                                variant: 'primary' as const
                              }

                        return (
                          <td key={`${assignment.id}-status`} className="w-0 px-1 py-2 text-center align-top">
                            <div className="flex flex-col items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                                  status
                                )}`}
                              >
                                {getStatusIcon(status)}
                                <span>{getStatusText(status)}</span>
                              </span>
                              <Link href={`/programs/${assignment.program_id}`} className="w-full">
                                <Button
                                  size="sm"
                                  variant={actionConfig.variant}
                                  className="flex items-center justify-center gap-2 px-4"
                                >
                                  {actionConfig.icon}
                                  <span>{actionConfig.label}</span>
                                </Button>
                              </Link>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {assignments?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ingen kurs ennå
              </h3>
              <p className="text-gray-600">
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
