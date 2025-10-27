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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tildelte kurs</p>
                <p className="text-2xl font-bold text-gray-900">{assignments?.length || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">I gang</p>
                <p className="text-2xl font-bold text-blue-600">{inProgress.length}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fullførte</p>
                <p className="text-2xl font-bold text-green-600">{completed.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Forsinkede</p>
                <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
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
              
              <div className="grid gap-3 ml-7">
                {themeAssignments.map((assignment) => {
                  const status = assignment.calculated_status
                  
                  return (
                    <Card key={assignment.id} className={status === 'overdue' ? 'border-red-200' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-base font-semibold text-gray-900">
                                {assignment.program_title}
                              </h3>
                              {assignment.is_auto_assigned && (
                                <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                  Auto-tildelt
                                </span>
                              )}
                            </div>
                            
                            {assignment.program_description && (
                              <p className="text-sm text-gray-600 mb-3">{assignment.program_description}</p>
                            )}
                            
                            <div className="flex items-center space-x-4 text-sm">
                              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full font-medium border ${getStatusColor(status)}`}>
                                {getStatusIcon(status)}
                                <span>{getStatusText(status)}</span>
                              </span>
                              
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className={status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                                  {formatDaysRemaining(assignment.days_remaining, status)}
                                </span>
                              </div>
                              
                              {assignment.progress_percentage > 0 && (
                                <div className="flex items-center space-x-2">
                                  <div className="w-16 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-primary-600 h-2 rounded-full" 
                                      style={{ width: `${assignment.progress_percentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {assignment.progress_percentage}%
                                  </span>
                                </div>
                              )}
                              
                              <span className="text-xs text-gray-500">
                                Tildelt: {new Date(assignment.assigned_at).toLocaleDateString('no-NO')}
                              </span>
                            </div>

                            {assignment.notes && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                                <strong>Notat:</strong> {assignment.notes}
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4">
                            <Link href={`/programs/${assignment.program_id}`}>
                              <Button 
                                size="sm"
                                variant={status === 'overdue' ? 'danger' : 'primary'}
                              >
                                {status === 'completed' ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Se igjen
                                  </>
                                ) : status === 'in_progress' ? (
                                  <>
                                    <PlayCircle className="w-4 h-4 mr-2" />
                                    Fortsett
                                  </>
                                ) : status === 'overdue' ? (
                                  <>
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Start nå
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="w-4 h-4 mr-2" />
                                    Start
                                  </>
                                )}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
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
