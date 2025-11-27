-- ============================================================================
-- DIAGNOSE: Trigger Issue - Why are user assignments not created?
-- ============================================================================
-- Dette skriptet diagnostiserer hvorfor triggeren ikke oppretter brukertildelinger
-- ============================================================================

-- 1. Sjekk om triggeren eksisterer og er aktiv
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_handle_program_department_assignment'
  AND event_object_table = 'program_assignments';

-- 2. Sjekk om det finnes avdelingstildelinger
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
LIMIT 10;

-- 3. Sjekk om det finnes brukere i avdelingene som er tildelt
SELECT 
  pa.id as assignment_id,
  pa.program_id,
  tp.title as program_title,
  d.name as department_name,
  ud.user_id,
  p.full_name as user_name,
  -- Sjekk om brukeren har fått en brukertildeling
  (SELECT COUNT(*) 
   FROM public.program_assignments pa2 
   WHERE pa2.program_id = pa.program_id 
     AND pa2.assigned_to_user_id = ud.user_id
  ) as has_user_assignment
FROM public.program_assignments pa
JOIN public.training_programs tp ON pa.program_id = tp.id
JOIN public.departments d ON pa.assigned_to_department_id = d.id
JOIN public.user_departments ud ON ud.department_id = pa.assigned_to_department_id
LEFT JOIN public.profiles p ON ud.user_id = p.id
WHERE pa.assigned_to_department_id IS NOT NULL
ORDER BY pa.created_at DESC
LIMIT 20;

-- 4. Sjekk alle brukertildelinger (inkludert auto-assigned)
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
LIMIT 20;

-- 5. Test om funksjonen kan kjøres manuelt (erstatt med faktiske ID-er)
-- Først, finn en avdelingstildeling å teste med:
SELECT 
  pa.id as dept_assignment_id,
  pa.program_id,
  pa.assigned_to_department_id,
  d.name as department_name,
  (SELECT user_id FROM public.user_departments WHERE department_id = pa.assigned_to_department_id LIMIT 1) as test_user_id
FROM public.program_assignments pa
JOIN public.departments d ON pa.assigned_to_department_id = d.id
WHERE pa.assigned_to_department_id IS NOT NULL
LIMIT 1;

-- 6. Sjekk RLS-policies for program_assignments INSERT
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'program_assignments'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 7. Sjekk om funksjonen har SECURITY DEFINER
SELECT 
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'handle_program_department_assignment';

