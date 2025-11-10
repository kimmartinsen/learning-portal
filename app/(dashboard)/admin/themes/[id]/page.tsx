'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, BookOpen, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'

type ThemeRecord = {
  id: string
  name: string
  description: string | null
  company_id: string
}

type ProgramRecord = {
  id: string
  title: string
  description: string | null
}

type ModuleRecord = {
  id: string
  program_id: string
  order_index: number
}

type ProfileRecord = {
  id: string
  full_name: string | null
  department_id: string | null
  email: string | null
}

type AssignmentRecord = {
  id: string
  program_id: string
  assigned_to_user_id: string | null
  due_date: string
  status: string
  completed_at: string | null
  assigned_at: string | null
  notes: string | null
  is_mandatory: boolean | null
  profiles: ProfileRecord | null
  user_progress: {
    id: string
    module_id: string
    status: string | null
  }[] | null
}

type DepartmentRecord = {
  id: string
  name: string
}

type UserProgramStatus = {
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  completedModules: number
  totalModules: number
  progressPercent: number
  dueDate: string
  completedAt: string | null
}

type UserRow = {
  userId: string
  name: string
  email: string | null
  departmentName: string
  programs: Record<string, UserProgramStatus>
}

interface ThemeDetailPageProps {
  params: { id: string }
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

export default function ThemeDetailPage({ params }: ThemeDetailPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<ThemeRecord | null>(null)
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [modulesByProgram, setModulesByProgram] = useState<Record<string, ModuleRecord[]>>({})
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [departmentMap, setDepartmentMap] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        setError('Kunne ikke hente brukerprofil')
        return
      }

      if (profile.role !== 'admin') {
        setError('Du har ikke tilgang til denne siden')
        return
      }

      const { data: themeData, error: themeError } = await supabase
        .from('themes')
        .select('id, name, description, company_id')
        .eq('id', params.id)
        .single()

      if (themeError || !themeData) {
        setError('Fant ikke tema')
        return
      }

      if (themeData.company_id !== profile.company_id) {
        setError('Dette temaet tilhører et annet selskap')
        return
      }

      setTheme(themeData)

      const { data: programsData, error: programsError } = await supabase
        .from('training_programs')
        .select('id, title, description')
        .eq('theme_id', params.id)
        .order('created_at', { ascending: true })

      if (programsError) {
        throw programsError
      }

      const orderedPrograms = programsData || []
      setPrograms(orderedPrograms)

      const programIds = orderedPrograms.map((p) => p.id)

      if (programIds.length === 0) {
        setAssignments([])
        setModulesByProgram({})
      } else {
        const { data: moduleData, error: modulesError } = await supabase
          .from('modules')
          .select('id, program_id, order_index')
          .in('program_id', programIds)
          .order('created_at', { ascending: true })

        if (modulesError) {
          throw modulesError
        }

        const moduleMap: Record<string, ModuleRecord[]> = {}
        ;(moduleData || []).forEach((module) => {
          if (!moduleMap[module.program_id]) {
            moduleMap[module.program_id] = []
          }
          moduleMap[module.program_id].push(module)
        })

        setModulesByProgram(moduleMap)

        const { data: assignmentData, error: assignmentError } = await supabase
          .from('program_assignments')
          .select(`
            id,
            program_id,
            assigned_to_user_id,
            due_date,
            status,
            completed_at,
            assigned_at,
            notes,
            is_mandatory,
            profiles:assigned_to_user_id (
              id,
              full_name,
              department_id,
              email
            ),
            user_progress (
              id,
              module_id,
              status
            )
          `)
          .in('program_id', programIds)
          .not('assigned_to_user_id', 'is', null)

        if (assignmentError) {
          throw assignmentError
        }

        const normalizedAssignments: AssignmentRecord[] = (assignmentData || []).map(
          (assignment: any) => ({
            ...assignment,
            profiles: Array.isArray(assignment.profiles)
              ? (assignment.profiles[0] as ProfileRecord | undefined) || null
              : (assignment.profiles as ProfileRecord | null)
          })
        )

        setAssignments(normalizedAssignments)
      }

      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', profile.company_id)

      if (!departmentsError && departmentsData) {
        const deptMap: Record<string, string> = {}
        ;(departmentsData as DepartmentRecord[]).forEach((dept) => {
          deptMap[dept.id] = dept.name
        })
        setDepartmentMap(deptMap)
      }
    } catch (err: any) {
      console.error('Error fetching theme analytics:', err)
      setError('Kunne ikke hente data for temaet')
      toast.error('Kunne ikke hente data for temaet')
    } finally {
      setLoading(false)
    }
  }

  const { userRows, summary } = useMemo(() => {
    const userMap = new Map<string, UserRow>()
    let completedCount = 0
    let overdueCount = 0
    let inProgressCount = 0

    assignments.forEach((assignment) => {
      if (!assignment.profiles || !assignment.assigned_to_user_id) return

      const userId = assignment.profiles.id
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          name: assignment.profiles.full_name || 'Ukjent bruker',
          email: assignment.profiles.email,
          departmentName: assignment.profiles.department_id
            ? departmentMap[assignment.profiles.department_id] || 'Uten avdeling'
            : 'Uten avdeling',
          programs: {}
        })
      }

      const row = userMap.get(userId)!
      const modules = modulesByProgram[assignment.program_id] || []
      const totalModules = modules.length || 0
      const completedModules = (assignment.user_progress || []).filter(
        (entry) => entry.status === 'completed'
      ).length

      let status: UserProgramStatus['status'] = 'not_started'

      if (assignment.completed_at) {
        status = 'completed'
        completedCount += 1
      } else {
        const dueDate = new Date(assignment.due_date)
        const now = new Date()
        const hasProgress = completedModules > 0 || (assignment.user_progress || []).some(
          (entry) => entry.status === 'in_progress'
        )

        if (dueDate < now) {
          status = 'overdue'
          overdueCount += 1
        } else if (assignment.status === 'started' || hasProgress) {
          status = 'in_progress'
          inProgressCount += 1
        } else if (assignment.status === 'completed') {
          status = 'completed'
          completedCount += 1
        }
      }

      const progressPercent =
        totalModules > 0
          ? Math.round((completedModules / totalModules) * 100)
          : status === 'completed'
          ? 100
          : 0

      row.programs[assignment.program_id] = {
        status,
        completedModules,
        totalModules,
        progressPercent,
        dueDate: assignment.due_date,
        completedAt: assignment.completed_at
      }
    })

    return {
      userRows: Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      summary: {
        totalAssignments: assignments.length,
        completedCount,
        overdueCount,
        inProgressCount
      }
    }
  }, [assignments, departmentMap, modulesByProgram])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
            <div>
              <div className="h-4 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
              <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />
            </div>
          </div>
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              Laster oversikt...
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !theme) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-6">
          <h1 className="text-2xl font-semibold text-gray-900">Noe gikk galt</h1>
          <p className="text-gray-600">{error || 'Fant ikke temaet du ser etter.'}</p>
          <Button onClick={() => router.push('/dashboard/admin/themes')}>
            Tilbake til temaer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/admin/themes')}
              className="text-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Temaer
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{theme.name}</h1>
              {theme.description && (
                <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <Link href="/dashboard/admin/reports">
              <Button variant="secondary">Rapporter</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Brukere i temaet</p>
                <p className="text-2xl font-semibold text-gray-900">{userRows.length}</p>
              </div>
              <Users className="w-8 h-8 text-primary-600" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Kurs</p>
                <p className="text-2xl font-semibold text-gray-900">{programs.length}</p>
              </div>
              <BookOpen className="w-8 h-8 text-primary-600" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Fullført</p>
                <p className="text-2xl font-semibold text-green-600">
                  {summary.completedCount}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Forsinket</p>
                <p className="text-2xl font-semibold text-red-600">
                  {summary.overdueCount}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            {programs.length === 0 ? (
              <div className="text-center text-gray-600">
                <p>Ingen kurs er knyttet til dette temaet ennå.</p>
                <Link href="/dashboard/admin/programs">
                  <Button className="mt-4">
                    Opprett kurs i temaet
                  </Button>
                </Link>
              </div>
            ) : userRows.length === 0 ? (
              <div className="text-center text-gray-600">
                <p>Ingen brukere er tildelt kurs i dette temaet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="inline-table w-auto divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-40 px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Bruker
                        </th>
                        {programs.map((program) => (
                          <th
                            key={program.id}
                            className="w-0 px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                          >
                            {program.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {userRows.map((row) => (
                        <tr key={row.userId}>
                          <td className="w-40 px-2 py-2 text-left text-sm font-medium text-gray-900 whitespace-nowrap">
                            {row.name}
                          </td>
                          {programs.map((program) => {
                            const status = row.programs[program.id]

                            if (!status) {
                              return (
                                <td key={`${row.userId}-${program.id}`} className="w-0 px-1 py-2 text-left align-middle">
                                  <span className="inline-flex items-center justify-start rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                                    Ikke tildelt
                                  </span>
                                </td>
                              )
                            }

                            const config = statusConfig[status.status]

                            return (
                              <td key={`${row.userId}-${program.id}`} className="w-0 px-1 py-2 text-left align-middle">
                                <span
                                  className={`inline-flex items-center justify-start gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.badgeClass} whitespace-nowrap`}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

