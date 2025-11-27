-- Test: Prøv direkte INSERT i program_assignments
-- Dato: 2025-11-27
-- Dette tester om vi kan INSERTe direkte uten feil

DO $$
DECLARE
  v_test_assignment_id UUID;
  v_program_id UUID;
  v_dept_id UUID;
  v_user_id UUID;
BEGIN
  -- Hent ekte IDer fra databasen
  SELECT id INTO v_program_id FROM public.training_programs LIMIT 1;
  SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
  SELECT id INTO v_user_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'FEIL: Ingen programmer funnet';
    RETURN;
  END IF;

  IF v_dept_id IS NULL THEN
    RAISE NOTICE 'FEIL: Ingen avdelinger funnet';
    RETURN;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'FEIL: Ingen admin brukere funnet';
    RETURN;
  END IF;

  RAISE NOTICE 'Tester med:';
  RAISE NOTICE '  Program ID: %', v_program_id;
  RAISE NOTICE '  Department ID: %', v_dept_id;
  RAISE NOTICE '  User ID: %', v_user_id;

  -- TEST 1: Insert department assignment
  BEGIN
    INSERT INTO public.program_assignments (
      program_id,
      assigned_to_department_id,
      assigned_by,
      due_date,
      notes,
      status
    ) VALUES (
      v_program_id,
      v_dept_id,
      v_user_id,
      NOW() + INTERVAL '14 days',
      'TEST - KAN SLETTES',
      'assigned'
    ) RETURNING id INTO v_test_assignment_id;

    RAISE NOTICE '✅ SUKSESS! Department assignment opprettet med ID: %', v_test_assignment_id;

    -- Slett test-data
    DELETE FROM public.program_assignments WHERE id = v_test_assignment_id;
    RAISE NOTICE '✅ Test-data slettet';

  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ FEIL ved INSERT: %', SQLERRM;
      RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
      RAISE NOTICE 'Detaljer: %', SQLERRM;
  END;

  -- TEST 2: Insert user assignment
  BEGIN
    INSERT INTO public.program_assignments (
      program_id,
      assigned_to_user_id,
      assigned_by,
      due_date,
      notes,
      status,
      is_auto_assigned
    ) VALUES (
      v_program_id,
      v_user_id,
      v_user_id,
      NOW() + INTERVAL '14 days',
      'TEST - KAN SLETTES',
      'assigned',
      false
    ) RETURNING id INTO v_test_assignment_id;

    RAISE NOTICE '✅ SUKSESS! User assignment opprettet med ID: %', v_test_assignment_id;

    -- Slett test-data
    DELETE FROM public.program_assignments WHERE id = v_test_assignment_id;
    RAISE NOTICE '✅ Test-data slettet';

  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ FEIL ved INSERT: %', SQLERRM;
      RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
  END;

END $$;
