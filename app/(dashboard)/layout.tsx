import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/Sidebar'
import { Topbar } from '@/components/shared/Topbar'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      companies (
        name,
        logo_url
      )
    `)
    .eq('id', session.user.id)
    .single()

  if (error) {
    console.error('Error fetching profile in layout:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    // If RLS is blocking, we need to show an error page instead of redirecting
    // because redirecting will cause a loop
    throw new Error(`Kunne ikke hente brukerprofil: ${error.message}. Dette kan være et RLS-problem.`)
  }

  if (!profile) {
    console.error('No profile found for user:', session.user.id)
    throw new Error('Brukerprofil ikke funnet. Kontakt administrator.')
  }

  // Sjekk om brukeren er instruktør for noen kurs
  const { count } = await supabase
    .from('training_programs')
    .select('id', { count: 'exact', head: true })
    .eq('instructor_id', profile.id)
    .eq('company_id', profile.company_id)
  
  const isInstructor = (count || 0) > 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <Topbar user={profile} className="border-b border-gray-200 dark:border-gray-900 lg:pl-[14rem]" />
      <div className="flex">
        <Sidebar user={profile} isInstructor={isInstructor} />
        <main className="flex-1 px-6 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
