import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Users, BookOpen, Award, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
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
    .select('*, companies(name)')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get dashboard stats based on role
  let stats: any = {}

  if (profile.role === 'admin') {
    // Admin stats
    const [
      { count: totalUsers },
      { count: totalPrograms },
      { count: totalDepartments },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id),
      supabase
        .from('training_programs')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id),
      supabase
        .from('departments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id),
    ])

    stats = {
      totalUsers: totalUsers || 0,
      totalPrograms: totalPrograms || 0,
      totalDepartments: totalDepartments || 0,
    }
  } else if (profile.role === 'instructor') {
    // Instructor stats
    const [
      { count: myPrograms },
      { count: totalParticipants },
    ] = await Promise.all([
      supabase
        .from('training_programs')
        .select('id', { count: 'exact', head: true })
        .eq('instructor_id', profile.id),
      supabase
        .from('user_progress')
        .select('user_id', { count: 'exact', head: true })
        .in('program_id', 
          (await supabase
            .from('training_programs')
            .select('id')
            .eq('instructor_id', profile.id)
          ).data?.map(p => p.id) || []
        ),
    ])

    stats = {
      myPrograms: myPrograms || 0,
      totalParticipants: totalParticipants || 0,
    }
  } else {
    // User stats
    const [
      { count: assignedPrograms },
      { count: completedPrograms },
      { count: myBadges },
    ] = await Promise.all([
      supabase
        .from('user_progress')
        .select('program_id', { count: 'exact', head: true })
        .eq('user_id', profile.id),
      supabase
        .from('user_progress')
        .select('program_id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'completed'),
      supabase
        .from('badges')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id),
    ])

    stats = {
      assignedPrograms: assignedPrograms || 0,
      completedPrograms: completedPrograms || 0,
      myBadges: myBadges || 0,
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Velkommen, {profile.full_name}!
        </h1>
        <p className="text-gray-600">
          {profile.companies?.name} - {
            profile.role === 'admin' ? 'Administrator' : 
            profile.role === 'instructor' ? 'Instruktør' : 'Bruker'
          }
        </p>
      </div>

      {/* Stats Cards */}
      {profile.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Totale brukere</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
                <Users className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Kurs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPrograms}</p>
                </div>
                <BookOpen className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avdelinger</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDepartments}</p>
                </div>
                <Users className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {profile.role === 'instructor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Mine kurs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.myPrograms}</p>
                </div>
                <BookOpen className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Totale deltakere</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalParticipants}</p>
                </div>
                <Users className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {profile.role === 'user' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tildelte kurs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.assignedPrograms}</p>
                </div>
                <BookOpen className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fullførte kurs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedPrograms}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Oppnådde badges</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.myBadges}</p>
                </div>
                <Award className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Hurtighandlinger</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.role === 'admin' && (
                <>
                  <a
                    href="/admin/users"
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-primary-600" />
                      <span className="text-sm font-medium">Administrer brukere</span>
                    </div>
                  </a>
                  <a
                    href="/admin/programs"
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <BookOpen className="h-5 w-5 text-primary-600" />
                      <span className="text-sm font-medium">Opprett nytt kurs</span>
                    </div>
                  </a>
                </>
              )}
              
              {profile.role === 'instructor' && (
                <>
                  <a
                    href="/instructor/programs"
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <BookOpen className="h-5 w-5 text-primary-600" />
                      <span className="text-sm font-medium">Se mine kurs</span>
                    </div>
                  </a>
                </>
              )}
              
              {profile.role === 'user' && (
                <a
                  href="/my-learning"
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <BookOpen className="h-5 w-5 text-primary-600" />
                    <span className="text-sm font-medium">Fortsett opplæring</span>
                  </div>
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Siste aktivitet</h3>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500 text-center py-8">
              Ingen nylig aktivitet å vise
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
