import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const getSessionAndProfile = cache(async () => {
  const supabase = createServerSupabaseClient()

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    return { session: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', session.user.id)
    .single()

  return { session, profile }
})

export default async function DashboardPage() {
  const { session, profile } = await getSessionAndProfile()

  if (!session) {
    redirect('/login')
  }

  if (!profile) {
    redirect('/login')
  }

  if (profile.role === 'admin') {
    redirect('/admin')
  }

  if (profile.role === 'instructor') {
    redirect('/dashboard/instructor/programs')
  }

  redirect('/dashboard/my-learning')
}
