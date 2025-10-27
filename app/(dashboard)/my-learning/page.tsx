import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BookOpen, Clock, Award, PlayCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface ProgramProgress {
  id: string
  program_id: string
  status: string
  completed_at: string | null
  training_programs: {
    id: string
    title: string
    description: string | null
    deadline: string | null
    is_mandatory: boolean
    badge_enabled: boolean
  }
  _count?: {
    modules: number
    completed_modules: number
  }
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
    .select('id, role, company_id, department_id')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get user's assigned programs through department or direct assignment
  // For now, we'll get all programs from the company (simplified)
  const { data: programs, error } = await supabase
    .from('training_programs')
    .select(`
      id,
      title,
      description,
      deadline,
      is_mandatory,
      badge_enabled,
      program_departments!inner (
        department_id
      )
    `)
    .eq('company_id', profile.company_id)
    .eq('program_departments.department_id', profile.department_id)

  if (error) {
    console.error('Error fetching programs:', error)
  }

  // Get user's progress for these programs
  const programIds = programs?.map(p => p.id) || []
  const { data: progressData } = await supabase
    .from('user_progress')
    .select('program_id, status, completed_at')
    .eq('user_id', profile.id)
    .in('program_id', programIds)

  // Get user's badges
  const { data: badges } = await supabase
    .from('badges')
    .select('program_id')
    .eq('user_id', profile.id)

  const progressMap = new Map(progressData?.map(p => [p.program_id, p]) || [])
  const badgeMap = new Map(badges?.map(b => [b.program_id, true]) || [])

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== 'completed') return 'text-red-600 bg-red-50'
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'in_progress': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Fullført'
      case 'in_progress': return 'I gang'
      default: return 'Ikke startet'
    }
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null
    const date = new Date(deadline)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} dager forsinket`, overdue: true }
    if (diffDays === 0) return { text: 'Frist i dag', overdue: false }
    if (diffDays === 1) return { text: 'Frist i morgen', overdue: false }
    return { text: `${diffDays} dager igjen`, overdue: false }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Min opplæring</h1>
        <p className="text-gray-600">Oversikt over dine opplæringsprogrammer</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tildelte programmer</p>
                <p className="text-2xl font-bold text-gray-900">{programs?.length || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fullførte</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressData?.filter(p => p.status === 'completed').length || 0}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Oppnådde badges</p>
                <p className="text-2xl font-bold text-gray-900">{badges?.length || 0}</p>
              </div>
              <Award className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Programs List */}
      <div className="space-y-4">
        {programs && programs.length > 0 ? (
          programs.map((program) => {
            const progress = progressMap.get(program.id)
            const hasBadge = badgeMap.has(program.id)
            const deadline = formatDeadline(program.deadline)
            const status = progress?.status || 'not_started'
            
            return (
              <Card key={program.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
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
                        {hasBadge && (
                          <Award className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      
                      {program.description && (
                        <p className="text-gray-600 mb-3">{program.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm">
                        <span className={`inline-flex px-2 py-1 rounded-full font-medium ${getStatusColor(status, deadline?.overdue || false)}`}>
                          {getStatusText(status)}
                        </span>
                        
                        {deadline && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className={deadline.overdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              {deadline.text}
                            </span>
                          </div>
                        )}
                        
                        {progress?.completed_at && (
                          <span className="text-gray-600">
                            Fullført: {new Date(progress.completed_at).toLocaleDateString('no-NO')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <Link href={`/programs/${program.id}`}>
                        <Button size="sm">
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
          })
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ingen opplæringsprogrammer ennå
              </h3>
              <p className="text-gray-600">
                Du har ikke blitt tildelt noen opplæringsprogrammer ennå. 
                Kontakt din administrator for mer informasjon.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
