import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CourseItemsManager from './CourseItemsManager'

interface PageProps {
  params: { id: string }
}

export default async function CourseItemsPage({ params }: PageProps) {
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
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // Get program
  const { data: program, error } = await supabase
    .from('training_programs')
    .select(`
      *,
      course_items (
        *
      )
    `)
    .eq('id', params.id)
    .eq('company_id', profile.company_id)
    .single()

  if (error || !program) {
    redirect('/admin/programs')
  }

  // Check if this is a physical course
  if (program.course_type !== 'physical-course') {
    redirect(`/admin/programs/${params.id}/modules`)
  }

  return (
    <CourseItemsManager
      program={program}
      companyId={profile.company_id}
    />
  )
}

