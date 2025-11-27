-- ============================================================================
-- VERIFY: Check if assign_program_to_department can read from training_programs
-- ============================================================================
-- Dette skriptet verifiserer at funksjonen kan lese fra training_programs
-- ============================================================================

-- 1. Sjekk om funksjonen eksisterer og har riktig definisjon
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✓'
    ELSE 'SECURITY INVOKER ✗'
  END as security_type,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'assign_program_to_department';

-- 2. Sjekk om training_programs tabellen eksisterer
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS aktivert ✓'
    ELSE 'RLS deaktivert ✗'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'training_programs';

-- 3. Sjekk alle RLS policies på training_programs
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'training_programs'
ORDER BY policyname;

-- 4. Test om funksjonen kan lese fra training_programs
-- (Dette vil feile hvis RLS blokkerer)
DO $$
DECLARE
  v_test_program_id UUID;
  v_deadline_days INTEGER;
BEGIN
  -- Prøv å hente et program
  SELECT id INTO v_test_program_id
  FROM public.training_programs
  LIMIT 1;
  
  IF v_test_program_id IS NULL THEN
    RAISE NOTICE 'Ingen programmer funnet i databasen';
  ELSE
    -- Prøv å hente deadline_days (som funksjonen gjør)
    SELECT deadline_days INTO v_deadline_days
    FROM public.training_programs
    WHERE id = v_test_program_id;
    
    RAISE NOTICE 'Funksjonen kan lese fra training_programs. Test program ID: %, deadline_days: %', 
      v_test_program_id, v_deadline_days;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Funksjonen kan IKKE lese fra training_programs: %', SQLERRM;
END $$;

-- 5. Sjekk om det finnes en policy som tillater postgres å lese
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%postgres%' OR qual::text LIKE '%current_user%' THEN 'Tillater postgres ✓'
    ELSE 'Tillater ikke postgres ✗'
  END as allows_postgres
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'training_programs'
  AND cmd = 'SELECT';

