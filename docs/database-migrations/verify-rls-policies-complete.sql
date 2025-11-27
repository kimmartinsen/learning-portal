-- ============================================================================
-- VERIFY: All RLS policies are correctly set up
-- ============================================================================
-- Dette skriptet verifiserer at alle RLS-policies er riktig satt opp
-- ============================================================================

-- 1. Sjekk RLS status på alle relevante tabeller
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS aktivert ✓'
    ELSE 'RLS deaktivert ✗'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('training_programs', 'program_assignments', 'user_departments', 'profiles')
ORDER BY tablename;

-- 2. Sjekk alle RLS policies på training_programs
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual::text LIKE '%postgres%' OR qual::text LIKE '%current_user%' THEN 'Tillater postgres ✓'
    ELSE 'Tillater ikke postgres ✗'
  END as allows_postgres,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'training_programs'
ORDER BY policyname, cmd;

-- 3. Sjekk alle RLS policies på program_assignments
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN with_check::text LIKE '%postgres%' OR with_check::text LIKE '%current_user%' THEN 'Tillater postgres ✓'
    WHEN cmd = 'INSERT' AND with_check::text IS NOT NULL THEN 'Har with_check'
    ELSE 'Ingen postgres-tilgang ✗'
  END as allows_postgres,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
ORDER BY policyname, cmd;

-- 4. Test om funksjonen kan lese fra training_programs
DO $$
DECLARE
  v_test_id UUID;
  v_deadline INTEGER;
BEGIN
  SELECT id, deadline_days INTO v_test_id, v_deadline
  FROM public.training_programs
  LIMIT 1;
  
  IF v_test_id IS NULL THEN
    RAISE NOTICE 'Ingen programmer funnet';
  ELSE
    RAISE NOTICE 'Funksjonen kan lese fra training_programs. Program ID: %, deadline: %', v_test_id, v_deadline;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Funksjonen kan IKKE lese fra training_programs: %', SQLERRM;
END $$;

-- 5. Test om funksjonen kan INSERT i program_assignments
-- (Dette vil feile hvis RLS blokkerer)
DO $$
DECLARE
  v_test_program_id UUID;
  v_test_dept_id UUID;
  v_test_admin_id UUID;
  v_result UUID;
BEGIN
  -- Hent test-data
  SELECT tp.id, d.id, p.id 
  INTO v_test_program_id, v_test_dept_id, v_test_admin_id
  FROM public.training_programs tp
  CROSS JOIN public.departments d
  CROSS JOIN public.profiles p
  WHERE p.role = 'admin'
  LIMIT 1;
  
  IF v_test_program_id IS NULL THEN
    RAISE NOTICE 'Ingen test-data funnet';
    RETURN;
  END IF;
  
  -- Prøv å kjøre funksjonen
  BEGIN
    v_result := assign_program_to_department(
      v_test_program_id,
      v_test_dept_id,
      v_test_admin_id,
      'Test fra verifisering'
    );
    
    RAISE NOTICE 'Funksjonen kan INSERT! Result ID: %', v_result;
    
    -- Rydd opp test-data
    DELETE FROM public.program_assignments 
    WHERE id = v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Funksjonen kan IKKE INSERT: %', SQLERRM;
    RAISE WARNING 'SQLSTATE: %', SQLSTATE;
  END;
END $$;

