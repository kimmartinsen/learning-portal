import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Optimized query to get users with their departments
 * Avoids N+1 problem by using a single join
 * Uses the user_departments many-to-many relationship
 */
export async function fetchUsersWithDepartments(
  supabase: SupabaseClient,
  companyId: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      user_departments(
        departments(
          id,
          name,
          description
        )
      )
    `)
    .eq('company_id', companyId)
    .order('full_name', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Optimized query to get programs with all related data
 */
export async function fetchProgramsWithRelations(
  supabase: SupabaseClient,
  companyId: string
) {
  const { data, error } = await supabase
    .from('training_programs')
    .select(`
      *,
      theme:themes(id, name, description),
      instructor:profiles!training_programs_instructor_id_fkey(
        id,
        full_name,
        email
      ),
      modules(
        id,
        title,
        type,
        order_index
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Optimized query to get user's assigned programs with progress
 */
export async function fetchUserAssignmentsWithProgress(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('program_assignments')
    .select(`
      *,
      program:training_programs(
        *,
        theme:themes(id, name),
        modules(id, title, type, order_index)
      ),
      progress:user_progress(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Optimized query to get theme with its programs and statistics
 */
export async function fetchThemeWithStats(
  supabase: SupabaseClient,
  themeId: string
) {
  const { data, error } = await supabase
    .from('themes')
    .select(`
      *,
      programs:training_programs(
        id,
        title,
        description,
        modules(id)
      )
    `)
    .eq('id', themeId)
    .single()

  if (error) throw error
  return data
}

