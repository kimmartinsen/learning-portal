'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, Lock, PauseCircle, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface User {
  id: string
  role: string
  company_id: string
}

type Course = {
  id: string
  title: string
  description: string | null
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

type CourseUserRow = {
  userId: string
  name: string
  email: string | null
  departmentName: string
  status: UserProgramStatus
}

type CourseProgressData = {
  course: Course
  userRows: CourseUserRow[]
}

type CourseProgressState = {
  loading: boolean
  data?: CourseProgressData
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
  const [user, setUser] = useState<User | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<Record<string, CourseProgressState>>({})

  useEffect(() => {
    fetchUserAndCourses()
  }, [])

  const fetchUserAndCourses = async () => {
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

      // Hent kurs instruktøren er tildelt
      const { data: coursesData, error: coursesError } = await supabase
        .from('training_programs')
        .select('id, title, description, course_type')
        .eq('instructor_id', profile.id)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })

      if (coursesError) throw coursesError

      if (!coursesData || coursesData.length === 0) {
        setUser(profile)
        setCourses([])
        return
      }

      setUser(profile)
      setCourses(coursesData || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Kunne ikke hente data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCourse = (courseId: string) => {
    if (expandedCourseId === courseId) {
      setExpandedCourseId(null)
    } else {
      setExpandedCourseId(courseId)
      // Hent progresjon når kurset utvides
      if (!progressState[courseId] || !progressState[courseId].data) {
        fetchCourseProgress(courseId)
      }
    }
  }

  const fetchCourseProgress = async (courseId: string) => {
    if (!user) {
      toast.error('Kunne ikke hente brukerdata')
      return
    }

    setProgressState(prev => ({
      ...prev,
      [courseId]: { loading: true }
    }))

    try {
      // Hent kurset
      const { data: courseData, error: courseError } = await supabase
        .from('training_programs')
        .select('id, title, description, course_type')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError

      const course = courseData as Course

      // Hent moduler for kurset
      const { data: moduleRows, error: modulesError } = await supabase
        .from('modules')
        .select('id, program_id')
        .eq('program_id', courseId)

      if (modulesError) throw modulesError

      const totalModules = (moduleRows || []).length

      // Hent assignments for dette kurset
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('program_assignments')
        .select(
          'id, program_id, assigned_to_user_id, due_date, status, completed_at, assigned_at, notes, is_auto_assigned'
        )
        .eq('program_id', courseId)
        .not('assigned_to_user_id', 'is', null)

      if (assignmentError) throw assignmentError

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

        if (profilesError) throw profilesError

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
          .eq('program_id', courseId)
          .in('user_id', userIds)

        if (progressError) throw progressError

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

      if (departmentsError) throw departmentsError

      const departmentMap = (departmentsData as { id: string; name: string }[] | null)?.reduce<
        Record<string, string>
      >((acc, department) => {
        acc[department.id] = department.name
        return acc
      }, {}) || {}

      // Finn hvilke avdelinger som tildelte kurset til hver bruker
      const { data: deptAssignmentsData } = await supabase
        .from('program_assignments')
        .select('program_id, assigned_to_department_id')
        .eq('program_id', courseId)
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

      // Bygg user rows
      const userRows: CourseUserRow[] = assignments.map(assignment => {
        if (!assignment.user_id) return null

        const profile = profileMap.get(assignment.user_id)
        if (!profile) return null

        // Bestem avdeling
        let departmentName = 'Uten avdeling'
        if (assignment.is_auto_assigned) {
          const assignedDepts = userAssignedDeptsMap.get(assignment.user_id) || []
          if (assignedDepts.length > 0) {
            departmentName = assignedDepts.join(', ')
          }
        } else {
          departmentName = 'Direkte tildelt'
        }

        const progressKey = `${assignment.user_id}:${assignment.program_id}`
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

        const progressPercent =
          totalModules > 0
            ? Math.round((completedModules / totalModules) * 100)
            : status === 'completed'
            ? 100
            : 0

        return {
          userId: assignment.user_id,
          name: profile.full_name || 'Ukjent bruker',
          email: profile.email,
          departmentName,
          status: {
            status,
            assignmentId: assignment.id,
            completedModules,
            totalModules,
            progressPercent,
            dueDate: assignment.due_date,
            completedAt: assignment.completed_at
          }
        }
      }).filter((row): row is CourseUserRow => row !== null)
        .sort((a, b) => a.name.localeCompare(b.name))

      setProgressState(prev => ({
        ...prev,
        [courseId]: {
          loading: false,
          data: {
            course,
            userRows
          }
        }
      }))
    } catch (error: any) {
      console.error('Error fetching course progress:', error)
      toast.error('Kunne ikke hente progresjon for kurset')

      setProgressState(prev => ({
        ...prev,
        [courseId]: {
          loading: false,
          error: 'Kunne ikke hente progresjon'
        }
      }))
    }
  }

  const handleStatusChange = async (courseId: string, assignmentId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus === 'completed' ? 'completed' : newStatus === 'in_progress' ? 'started' : 'assigned'
      }

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString()
      } else {
        updateData.completed_at = null
      }

      const { error } = await supabase
        .from('program_assignments')
        .update(updateData)
        .eq('id', assignmentId)

      if (error) throw error
      
      toast.success('Status oppdatert!')
      fetchCourseProgress(courseId)
      router.refresh()
    } catch (error: any) {
      toast.error('Kunne ikke oppdatere status: ' + error.message)
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
              <GraduationCap className="h-8 w-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Totale deltakere</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Object.values(progressState).reduce((sum, state) => 
                    sum + (state.data?.userRows.length || 0), 0
                  )}
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
          {courses.map((course) => {
            const isExpanded = expandedCourseId === course.id
            const progress = progressState[course.id]
            const isPhysicalCourse = course.course_type === 'physical-course'

            return (
              <Card key={course.id}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleCourse(course.id)}
                      className="flex items-center space-x-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none flex-grow"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary-600" />
                          {course.title}
                          {isPhysicalCourse && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                              Fysisk kurs
                            </span>
                          )}
                        </span>
                        {course.description && (
                          <span className="text-xs text-gray-500 font-normal">{course.description}</span>
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
                        return data.userRows.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Ingen brukere er tildelt dette kurset ennå.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="overflow-x-auto">
                              <table className="w-full divide-y divide-gray-200 dark:divide-gray-800">
                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                      Bruker
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                      Status
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                      Fremdrift
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                  {data.userRows.map((row) => {
                                    const config = statusConfig[row.status.status]
                                    const currentStatus = row.status.status === 'completed' ? 'completed' 
                                      : row.status.status === 'in_progress' ? 'in_progress'
                                      : 'not_started'

                                    return (
                                      <tr key={row.userId}>
                                        <td className="px-4 py-3 text-sm">
                                          <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                              {row.name}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                              {row.email}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                              {row.departmentName}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          {isPhysicalCourse ? (
                                            <select
                                              value={currentStatus}
                                              onChange={(e) => handleStatusChange(course.id, row.status.assignmentId, e.target.value)}
                                              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 cursor-pointer"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <option value="not_started">Ikke startet</option>
                                              <option value="in_progress">I gang</option>
                                              <option value="completed">Fullført</option>
                                            </select>
                                          ) : (
                                            <span
                                              className={`inline-flex items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.badgeClass}`}
                                            >
                                              {config.icon}
                                              <span>{config.label}</span>
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                                          {row.status.totalModules > 0 ? (
                                            <div className="flex flex-col items-center gap-1">
                                              <span>{row.status.completedModules} / {row.status.totalModules}</span>
                                              <div className="w-24 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                                                <div
                                                  className="bg-primary-600 h-2 rounded-full dark:bg-primary-500"
                                                  style={{ width: `${row.status.progressPercent}%` }}
                                                />
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-gray-400">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
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
