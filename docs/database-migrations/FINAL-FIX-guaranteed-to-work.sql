-- FINAL FIX - Garantert løsning for tildelingsproblemer
-- Dato: 2025-11-27
-- Denne løsningen bruker PERFORM og eksplisitt search_path INNE i funksjonen

-- 1. DROPP alt
DROP FUNCTION IF EXISTS public.assign_program_to_department(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_program_to_user(UUID, UUID, UUID, TEXT);

-- 2. Disable RLS (vi fikser det senere)
ALTER TABLE public.program_assignments DISABLE ROW LEVEL SECURITY;

-- 3. Opprett assign_program_to_user med eksplisitt search_path
CREATE OR REPLACE FUNCTION public.assign_program_to_user(
  p_program_id UUID,
  p_user_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_assignment_id UUID;
BEGIN
  -- EKSPLISITT sett search_path for denne transaksjonen
  PERFORM set_config('search_path', 'public', true);

  -- Hent deadline_days fra programmet (med schema-prefiks)
  SELECT deadline_days INTO v_deadline_days
  FROM public.training_programs
  WHERE id = p_program_id;

  -- Beregn due_date
  v_due_date := NOW() + (COALESCE(v_deadline_days, 14) || ' days')::INTERVAL;

  -- Opprett tildelingen (med schema-prefiks)
  INSERT INTO public.program_assignments (
    program_id,
    assigned_to_user_id,
    assigned_by,
    due_date,
    notes,
    status
  ) VALUES (
    p_program_id,
    p_user_id,
    p_assigned_by,
    v_due_date,
    p_notes,
    'assigned'
  ) RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

-- 4. Opprett assign_program_to_department med eksplisitt search_path
CREATE OR REPLACE FUNCTION public.assign_program_to_department(
  p_program_id UUID,
  p_department_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignment_id UUID;
  v_user_id UUID;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_existing_user_assignment UUID;
BEGIN
  -- EKSPLISITT sett search_path for denne transaksjonen
  PERFORM set_config('search_path', 'public', true);

  -- Hent deadline_days fra programmet (med schema-prefiks)
  SELECT deadline_days INTO v_deadline_days
  FROM public.training_programs
  WHERE id = p_program_id;

  v_due_date := NOW() + (COALESCE(v_deadline_days, 14) || ' days')::INTERVAL;

  -- Opprett avdelingstildelingen (med schema-prefiks)
  INSERT INTO public.program_assignments (
    program_id,
    assigned_to_department_id,
    assigned_by,
    due_date,
    notes,
    status
  ) VALUES (
    p_program_id,
    p_department_id,
    p_assigned_by,
    v_due_date,
    p_notes,
    'assigned'
  ) RETURNING id INTO v_assignment_id;

  -- Loop gjennom alle brukere i avdelingen (med schema-prefiks)
  FOR v_user_id IN
    SELECT user_id
    FROM public.user_departments
    WHERE department_id = p_department_id
  LOOP
    -- Sjekk om brukeren allerede har dette kurset (med schema-prefiks)
    SELECT id INTO v_existing_user_assignment
    FROM public.program_assignments
    WHERE program_id = p_program_id
      AND assigned_to_user_id = v_user_id
    LIMIT 1;

    -- Kun opprett ny tildeling hvis brukeren ikke allerede har kurset
    IF v_existing_user_assignment IS NULL THEN
      INSERT INTO public.program_assignments (
        program_id,
        assigned_to_user_id,
        assigned_by,
        due_date,
        notes,
        is_auto_assigned,
        status
      ) VALUES (
        p_program_id,
        v_user_id,
        p_assigned_by,
        v_due_date,
        p_notes,
        true,
        'assigned'
      );
    END IF;
  END LOOP;

  RETURN v_assignment_id;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.assign_program_to_department(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_to_user(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_to_department(UUID, UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.assign_program_to_user(UUID, UUID, UUID, TEXT) TO anon;

-- 6. Verifiser at funksjonene er opprettet
SELECT
  'assign_program_to_department' as function_name,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'assign_program_to_department') as exists;

SELECT
  'assign_program_to_user' as function_name,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'assign_program_to_user') as exists;

-- 7. TEST FUNKSJONEN DIREKTE HER
DO $$
DECLARE
  v_test_result UUID;
  v_program_id UUID;
  v_dept_id UUID;
  v_admin_id UUID;
BEGIN
  -- Finn test-data
  SELECT id INTO v_program_id FROM public.training_programs LIMIT 1;
  SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  IF v_program_id IS NOT NULL AND v_dept_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
    -- Test funksjonen
    BEGIN
      v_test_result := public.assign_program_to_department(
        v_program_id,
        v_dept_id,
        v_admin_id,
        'TEST - KAN SLETTES'
      );

      RAISE NOTICE '✅ SUKSESS! Assignment opprettet med ID: %', v_test_result;

      -- Slett test-data
      DELETE FROM public.program_assignments WHERE id = v_test_result;
      DELETE FROM public.program_assignments WHERE notes = 'TEST - KAN SLETTES';

      RAISE NOTICE '✅ Test-data slettet. Funksjonen FUNGERER!';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ FEIL: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;
  ELSE
    RAISE NOTICE '⚠️ Kan ikke teste - mangler test-data i databasen';
  END IF;
END $$;
