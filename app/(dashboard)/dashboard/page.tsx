import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', session.user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  if (profile.role === 'admin') {
    redirect('/dashboard/admin')
  }

  if (profile.role === 'instructor') {
    redirect('/dashboard/instructor/programs')
  }

  redirect('/dashboard/my-learning')
}
