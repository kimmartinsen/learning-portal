-- Diagnostisk SQL: Sjekk RLS policies og permissions
-- Dato: 2025-11-27
-- Formål: Finne ut hvorfor tildelinger ikke fungerer selv om kurs opprettes

-- 1. Sjekk om RLS er aktivert på tabellene
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('program_assignments', 'training_programs', 'user_departments', 'profiles');

-- 2. Vis alle RLS policies på program_assignments (dette er sannsynligvis problemet)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
ORDER BY policyname;

-- 3. Sjekk om SECURITY DEFINER funksjonene har BYPASSRLS
SELECT
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proconfig as config_settings,
  CASE
    WHEN p.proleakproof THEN 'LEAKPROOF'
    ELSE ''
  END as attributes
FROM pg_proc p
WHERE p.proname IN ('assign_program_to_department', 'assign_program_to_user')
  AND p.pronamespace = 'public'::regnamespace;

-- 4. Sjekk grants/permissions på program_assignments
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'program_assignments'
ORDER BY grantee, privilege_type;

-- 5. Test om vi kan inserere i program_assignments direkte
-- (Dette vil feile hvis RLS blokkerer, men vi vil se feilmeldingen)
DO $$
DECLARE
  test_id UUID;
BEGIN
  -- Prøv å sette inn en test-record (vi ruller tilbake etterpå)
  BEGIN
    INSERT INTO public.program_assignments (
      program_id,
      assigned_to_user_id,
      assigned_by,
      due_date,
      status
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::UUID, -- Dummy UUID
      '00000000-0000-0000-0000-000000000000'::UUID,
      '00000000-0000-0000-0000-000000000000'::UUID,
      NOW(),
      'assigned'
    ) RETURNING id INTO test_id;

    RAISE NOTICE 'INSERT SUCCESS: Test record created with id %', test_id;

    -- Slett test-recorden
    DELETE FROM public.program_assignments WHERE id = test_id;
    RAISE NOTICE 'Test record deleted successfully';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'INSERT FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
END $$;

-- 6. Sjekk om det finnes noen BEFORE INSERT triggers som kan blokkere
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'program_assignments';

-- 7. Tell faktiske assignments i databasen
SELECT
  COUNT(*) as total_assignments,
  COUNT(CASE WHEN assigned_to_department_id IS NOT NULL THEN 1 END) as department_assignments,
  COUNT(CASE WHEN assigned_to_user_id IS NOT NULL THEN 1 END) as user_assignments,
  COUNT(CASE WHEN is_auto_assigned = true THEN 1 END) as auto_assigned
FROM public.program_assignments;

-- 8. Sjekk siste opprettede assignments (hvis noen)
SELECT
  id,
  program_id,
  assigned_to_department_id,
  assigned_to_user_id,
  assigned_by,
  is_auto_assigned,
  status,
  created_at
FROM public.program_assignments
ORDER BY created_at DESC
LIMIT 10;

-- VIKTIG ANALYSE:
-- Hvis RLS er aktivert (rls_enabled = true) på program_assignments,
-- OG det finnes policies som ikke tillater INSERT,
-- DA må vi enten:
-- 1. Endre policiesen til å tillate INSERT for funksjonen
-- 2. ELLER gi funksjonen BYPASSRLS privilegium
-- 3. ELLER disable RLS midlertidig for å teste
