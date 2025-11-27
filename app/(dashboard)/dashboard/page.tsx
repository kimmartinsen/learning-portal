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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', session.user.id)
    .single()

  if (profileError) {
    console.error('Error fetching profile in dashboard:', profileError)
    console.error('Error details:', JSON.stringify(profileError, null, 2))
    return { session, profile: null, isInstructor: false }
  }

  // Sjekk om brukeren er instruktør for noen kurs
  let isInstructor = false
  if (profile) {
    const { count, error: instructorError } = await supabase
      .from('training_programs')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', profile.id)
      .eq('company_id', profile.company_id)
    
    if (instructorError) {
      console.error('Error checking instructor status:', instructorError)
    } else {
      isInstructor = (count || 0) > 0
    }
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
