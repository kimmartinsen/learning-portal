import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ProgramViewer from './ProgramViewer'

interface PageProps {
  params: { id: string }
}

export default async function ProgramPage({ params }: PageProps) {
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

  if (!profile) {
    redirect('/login')
  }

  // Check if user has access to this program (via program_assignments)
  const { data: assignment } = await supabase
    .from('program_assignments')
    .select('status')
    .eq('program_id', params.id)
    .eq('assigned_to_user_id', profile.id)
    .single()

  // If no assignment or status is locked/pending, deny access
  if (!assignment || assignment.status === 'locked' || assignment.status === 'pending') {
    redirect('/my-learning?error=locked')
  }

  // Get program with modules
  const { data: program, error } = await supabase
    .from('training_programs')
    .select(`
      id,
      title,
      description,
      is_mandatory,
      deadline,
      instructor_id,
      company_id,
      modules (
        *
      ),
      instructor:profiles!instructor_id (
        full_name
      )
    `)
    .eq('id', params.id)
    .eq('company_id', profile.company_id)
    .single()

  if (error || !program) {
    redirect('/my-learning')
  }

  // Get user's progress for this program
  const { data: userProgress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', profile.id)
    .eq('program_id', params.id)

  // Check if user is instructor for this program
  const isInstructor = program.instructor_id === profile.id

  return (
    <ProgramViewer
      program={program}
      userProgress={userProgress || []}
      userId={profile.id}
      isInstructor={isInstructor}
    />
  )
}
