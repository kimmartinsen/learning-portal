import { cache } from 'react'
import { supabase } from '@/lib/supabase/client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Cached function to get themes for a company
 * Uses React cache() for request-level memoization
 */
export const getThemes = cache(async (companyId: string) => {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
})

/**
 * Cached function to get departments for a company
 */
export const getDepartments = cache(async (companyId: string) => {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
})

/**
 * Cached function to get users with their departments (optimized with join)
 * Uses the user_departments many-to-many relationship
 */
export const getUsersWithDepartments = cache(async (companyId: string) => {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      user_departments(
        departments(
          id,
          name
        )
      )
    `)
    .eq('company_id', companyId)
    .order('full_name', { ascending: true })

  if (error) throw error
  return data
})

/**
 * Cached function to get programs with related data
 */
export const getProgramsWithRelations = cache(async (companyId: string) => {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('training_programs')
    .select(`
      *,
      theme:themes(id, name),
      instructor:profiles!training_programs_instructor_id_fkey(id, full_name),
      modules(id, title, type, order_index)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
})

