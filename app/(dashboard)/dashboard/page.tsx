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
    .select('id, role, company_id')
    .eq('id', session.user.id)
    .single()

  // Sjekk om brukeren er instruktør for noen kurs
  let isInstructor = false
  if (profile) {
    const { count } = await supabase
      .from('training_programs')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', profile.id)
      .eq('company_id', profile.company_id)
    
    isInstructor = (count || 0) > 0
  }

  return { session, profile, isInstructor }
})

export default async function DashboardPage() {
  const { session, profile, isInstructor } = await getSessionAndProfile()

  if (!session) {
    redirect('/login')
  }

  if (!profile) {
    redirect('/login')
  }

  if (profile.role === 'admin') {
    redirect('/admin')
  }

  // Hvis brukeren er instruktør for noen kurs, send til instruktør-oversikt
  if (isInstructor) {
    redirect('/instructor/programs')
  }

  // Vanlige brukere sendes direkte til Min opplæring
  redirect('/my-learning')
}
