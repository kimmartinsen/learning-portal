-- ============================================================================
-- VERIFY: Check if assignments are being created
-- ============================================================================
-- Dette skriptet sjekker om tildelinger faktisk blir opprettet i databasen
-- ============================================================================

-- 1. Sjekk alle avdelingstildelinger
SELECT 
  pa.id,
  pa.program_id,
  tp.title as program_title,
  pa.assigned_to_department_id,
  d.name as department_name,
  pa.assigned_by,
  pa.status,
  pa.created_at
FROM public.program_assignments pa
LEFT JOIN public.training_programs tp ON pa.program_id = tp.id
LEFT JOIN public.departments d ON pa.assigned_to_department_id = d.id
WHERE pa.assigned_to_department_id IS NOT NULL
ORDER BY pa.created_at DESC
LIMIT 10;

-- 2. Sjekk alle brukertildelinger (inkludert auto-assigned)
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

-- 3. Sjekk om triggeren eksisterer
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'program_assignments'
  AND trigger_name LIKE '%department%';

-- 4. Sjekk om funksjonen eksisterer
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✓'
    ELSE 'SECURITY INVOKER ✗'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'handle_program_department_assignment';

