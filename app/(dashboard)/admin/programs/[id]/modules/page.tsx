import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import ModuleBuilder from './ModuleBuilder'

interface PageProps {
  params: { id: string }
}

export default async function ModuleBuilderPage({ params }: PageProps) {
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

  // Get program with existing modules
  const { data: program, error } = await supabase
    .from('training_programs')
    .select(`
      *,
      modules (
        *
      )
    `)
    .eq('id', params.id)
    .eq('company_id', profile.company_id)
    .single()

  if (error || !program) {
    redirect('/admin/programs')
  }

  return (
    <ModuleBuilder
      program={program}
      companyId={profile.company_id}
    />
  )
}
