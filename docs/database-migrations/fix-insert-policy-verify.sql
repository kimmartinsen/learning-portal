-- ============================================================================
-- VERIFY AND FIX: Program Assignments INSERT Policy
-- ============================================================================
-- Dette skriptet sjekker og fikser RLS-policyen for INSERT i program_assignments
-- ============================================================================

-- 1. Sjekk eksisterende policy
SELECT 
  policyname,
  cmd as operation,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
  AND cmd = 'INSERT'
  AND policyname = 'Allow function inserts for admins';

-- 2. Fjern eksisterende policy
DROP POLICY IF EXISTS "Allow function inserts for admins" ON public.program_assignments;

-- 3. Opprett policy på nytt med eksplisitt postgres-sjekk
CREATE POLICY "Allow function inserts for admins" ON public.program_assignments FOR INSERT 
  WITH CHECK (
    -- PRIORITET 1: Tillat hvis current_user er postgres (SECURITY DEFINER funksjon)
    -- Dette er den viktigste sjekken og må komme først
    (current_user::text = 'postgres'::text)
    OR
    -- PRIORITET 2: Tillat direkte INSERT fra admin
    (
      auth.uid() = program_assignments.assigned_by
      AND EXISTS(
        SELECT 1 
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
      AND EXISTS(
        SELECT 1 
        FROM public.training_programs tp
        WHERE tp.id = program_assignments.program_id
          AND tp.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    OR
    -- PRIORITET 3: Fallback - Tillat hvis assigned_by er en admin
    EXISTS(
      SELECT 1 
      FROM public.profiles p
      JOIN public.training_programs tp ON tp.id = program_assignments.program_id
      WHERE p.id = program_assignments.assigned_by
        AND p.role = 'admin'
        AND p.company_id = tp.company_id
    )
  );

-- 4. Verifiser at policyen er opprettet riktig
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN with_check::text LIKE '%current_user%postgres%' 
      OR with_check::text LIKE '%postgres%'
    THEN 'Tillater postgres ✓'
    ELSE 'Tillater ikke postgres ✗'
  END as allows_postgres,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
  AND cmd = 'INSERT'
  AND policyname = 'Allow function inserts for admins';

-- 5. Test om policyen faktisk fungerer
DO $$
DECLARE
  v_test_program_id UUID;
  v_test_dept_id UUID;
  v_test_admin_id UUID;
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
  
  -- Prøv å kjøre funksjonen (som postgres)
  BEGIN
    PERFORM assign_program_to_department(
      v_test_program_id,
      v_test_dept_id,
      v_test_admin_id,
      'Test fra policy-verifisering'
    );
    
    RAISE NOTICE 'Funksjonen kan INSERT! Test vellykket.';
    
    -- Rydd opp test-data
    DELETE FROM public.program_assignments 
    WHERE program_id = v_test_program_id
      AND assigned_to_department_id = v_test_dept_id
      AND notes = 'Test fra policy-verifisering';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Funksjonen kan IKKE INSERT: %', SQLERRM;
    RAISE WARNING 'SQLSTATE: %', SQLSTATE;
  END;
END $$;

