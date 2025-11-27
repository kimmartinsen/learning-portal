'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BookOpen, Users, CheckCircle, Clock, XCircle, GraduationCap } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface User {
  id: string
  role: string
  company_id: string
}

interface Course {
  id: string
  title: string
  description: string | null
  course_type: 'e-course' | 'physical-course'
  deadline_days: number
  instructor_id: string | null
}

interface Assignment {
  id: string
  program_id: string
  assigned_to_user_id: string
  status: string
  completed_at: string | null
  due_date: string
  assigned_at: string
  user: {
    id: string
    full_name: string
    email: string
  }
  program: Course
}

export default function InstructorProgramsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({})
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
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

      if (!profile || profile.role !== 'instructor') {
        toast.error('Ikke autorisert')
        return
      }

      setUser(profile)

      // Hent kurs hvor brukeren er instruktør
      const { data: coursesData, error: coursesError } = await supabase
        .from('training_programs')
        .select('id, title, description, course_type, deadline_days, instructor_id')
        .eq('instructor_id', profile.id)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (coursesError) throw coursesError
      setCourses(coursesData || [])

      // Hent assignments for disse kursene
      if (coursesData && coursesData.length > 0) {
        const courseIds = coursesData.map(c => c.id)
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('program_assignments')
          .select(`
            id,
            program_id,
            assigned_to_user_id,
            status,
            completed_at,
            due_date,
            assigned_at,
            assigned_to_user:profiles!program_assignments_assigned_to_user_id_fkey(
              id,
              full_name,
              email
            )
          `)
          .in('program_id', courseIds)
          .not('assigned_to_user_id', 'is', null)
          .order('assigned_at', { ascending: false })

        if (assignmentsError) throw assignmentsError

        // Grupper assignments per kurs
        const assignmentsByCourse: Record<string, Assignment[]> = {}
        if (assignmentsData) {
          assignmentsData.forEach((assignment: any) => {
            const course = coursesData.find(c => c.id === assignment.program_id)
            if (!course) return

            const user = Array.isArray(assignment.assigned_to_user)
              ? assignment.assigned_to_user[0]
              : assignment.assigned_to_user

            if (!assignmentsByCourse[assignment.program_id]) {
              assignmentsByCourse[assignment.program_id] = []
            }

            assignmentsByCourse[assignment.program_id].push({
              ...assignment,
              user: user || { id: '', full_name: 'Ukjent bruker', email: '' },
              program: course
            })
          })
        }
        setAssignments(assignmentsByCourse)
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmPhysicalCourse = async (assignmentId: string) => {
    if (!confirm('Er du sikker på at du vil bekrefte at dette kurset er gjennomført?')) {
      return
    }

    try {
      setUpdatingStatus(assignmentId)
      const { error } = await supabase
        .from('program_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId)

      if (error) throw error
      toast.success('Kurs bekreftet som gjennomført!')
      await fetchData()
      router.refresh()
    } catch (error: any) {
      console.error('Error confirming course:', error)
      toast.error('Kunne ikke bekrefte kurs: ' + error.message)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-500/20 dark:border-green-500/40'
      case 'started':
        return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-200 dark:bg-blue-500/20 dark:border-blue-500/40'
      case 'overdue':
        return 'text-red-600 bg-red-50 border-red-200 dark:text-red-200 dark:bg-red-500/20 dark:border-red-500/40'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Fullført'
      case 'started':
        return 'I gang'
      case 'overdue':
        return 'Forfalt'
      default:
        return 'Ikke startet'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'started':
        return <Clock className="w-4 h-4" />
      case 'overdue':
        return <XCircle className="w-4 h-4" />
      default:
        return <BookOpen className="w-4 h-4" />
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Mine kurs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{courses.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totale deltakere</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Object.values(assignments).flat().length}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Fysiske kurs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {courses.filter(c => c.course_type === 'physical-course').length}
                </p>
              </div>
              <GraduationCap className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Courses List */}
      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Ingen kurs ennå
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Du er ikke satt opp som instruktør for noen kurs ennå.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => {
            const courseAssignments = assignments[course.id] || []
            const isPhysicalCourse = course.course_type === 'physical-course'

            return (
              <Card key={course.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {course.title}
                        </h2>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          isPhysicalCourse
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        }`}>
                          {isPhysicalCourse ? 'Fysisk kurs' : 'E-kurs'}
                        </span>
                      </div>
                      {course.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {course.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {courseAssignments.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Ingen deltakere tildelt dette kurset ennå.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Deltakere ({courseAssignments.length})
                      </h3>
                      <div className="space-y-2">
                        {courseAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {assignment.user.full_name}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {assignment.user.email}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(assignment.status)}`}
                                >
                                  <span className="flex items-center gap-1">
                                    {getStatusIcon(assignment.status)}
                                    {getStatusText(assignment.status)}
                                  </span>
                                </span>
                              </div>
                              {assignment.completed_at && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Fullført: {new Date(assignment.completed_at).toLocaleDateString('no-NO')}
                                </p>
                              )}
                            </div>
                            {isPhysicalCourse && assignment.status !== 'completed' && (
                              <Button
                                size="sm"
                                onClick={() => handleConfirmPhysicalCourse(assignment.id)}
                                loading={updatingStatus === assignment.id}
                                disabled={updatingStatus === assignment.id}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Bekreft gjennomført
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
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
