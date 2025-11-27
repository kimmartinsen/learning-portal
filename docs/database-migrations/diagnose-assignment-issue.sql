-- ============================================================================
-- DIAGNOSE: Assignment Issue - Full Diagnostic
-- ============================================================================
-- Dette skriptet diagnostiserer hvorfor tildelinger ikke vises for brukere
-- ============================================================================

-- 1. Sjekk om triggeren eksisterer og er aktiv
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'program_assignments'
  AND trigger_name LIKE '%department%';

-- 2. Sjekk de 5 siste avdelingstildelinger
SELECT 
  pa.id,
  pa.program_id,
  tp.title as program_title,
  pa.assigned_to_department_id,
  d.name as department_name,
  pa.assigned_by,
  pa.status,
  pa.created_at,
  (SELECT COUNT(*) FROM public.user_departments WHERE department_id = pa.assigned_to_department_id) as users_in_dept
FROM public.program_assignments pa
LEFT JOIN public.training_programs tp ON pa.program_id = tp.id
LEFT JOIN public.departments d ON pa.assigned_to_department_id = d.id
WHERE pa.assigned_to_department_id IS NOT NULL
ORDER BY pa.created_at DESC
LIMIT 5;

-- 3. Sjekk om brukertildelinger ble opprettet for de siste avdelingstildelingene
SELECT 
  pa_dept.id as dept_assignment_id,
  pa_dept.program_id,
  tp.title as program_title,
  pa_dept.assigned_to_department_id,
  d.name as department_name,
  COUNT(pa_user.id) as user_assignments_created,
  (SELECT COUNT(*) FROM public.user_departments WHERE department_id = pa_dept.assigned_to_department_id) as total_users_in_dept
FROM public.program_assignments pa_dept
LEFT JOIN public.training_programs tp ON pa_dept.program_id = tp.id
LEFT JOIN public.departments d ON pa_dept.assigned_to_department_id = d.id
LEFT JOIN public.program_assignments pa_user 
  ON pa_user.program_id = pa_dept.program_id 
  AND pa_user.assigned_to_user_id IN (
    SELECT user_id FROM public.user_departments WHERE department_id = pa_dept.assigned_to_department_id
  )
  AND pa_user.is_auto_assigned = true
WHERE pa_dept.assigned_to_department_id IS NOT NULL
  AND pa_dept.created_at > NOW() - INTERVAL '1 day'
GROUP BY pa_dept.id, pa_dept.program_id, tp.title, pa_dept.assigned_to_department_id, d.name
ORDER BY pa_dept.created_at DESC
LIMIT 5;

-- 4. Sjekk de 10 siste brukertildelingene
SELECT 
  pa.id,
  pa.program_id,
  tp.title as program_title,
  pa.assigned_to_user_id,
  p.full_name as user_name,
  pa.is_auto_assigned,
  pa.status,
  pa.created_at
FROM public.program_assignments pa
LEFT JOIN public.training_programs tp ON pa.program_id = tp.id
LEFT JOIN public.profiles p ON pa.assigned_to_user_id = p.id
WHERE pa.assigned_to_user_id IS NOT NULL
ORDER BY pa.created_at DESC
LIMIT 10;

-- 5. Test: Hent en spesifikk bruker og se hva de har tilgang til
-- (Erstatt USER_ID med en faktisk bruker-ID fra din database)
SELECT 
  ua.*,
  pa.status as raw_status,
  pa.is_auto_assigned
FROM public.user_assignments ua
LEFT JOIN public.program_assignments pa ON ua.id = pa.id
WHERE ua.user_id = (SELECT id FROM public.profiles WHERE full_name LIKE '%Palmgren%' LIMIT 1)
ORDER BY ua.assigned_at DESC;

-- 6. Sjekk RLS-policies på program_assignments for SELECT
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
  AND cmd = 'SELECT'
ORDER BY policyname;

