import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/Sidebar'
import { Topbar } from '@/components/shared/Topbar'

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

  if (error || !profile) {
    console.error('Error fetching profile:', error)
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar user={profile} />
      
      <div className="flex-1 lg:ml-56">
        <Topbar user={profile} />
        
        <main className="pl-2 pr-8 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
