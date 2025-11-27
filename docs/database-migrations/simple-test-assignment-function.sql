-- Test: Kjør assign_program_to_department direkte for å se hvor feilen oppstår
-- Dato: 2025-11-27
-- Formål: Identifisere nøyaktig hvor i funksjonen feilen oppstår

-- Først, finn ekte IDer fra databasen som vi kan bruke til testing
DO $$
DECLARE
  v_program_id UUID;
  v_department_id UUID;
  v_admin_id UUID;
  v_result UUID;
BEGIN
  -- Hent et ekte program
  SELECT id INTO v_program_id
  FROM public.training_programs
  LIMIT 1;

  IF v_program_id IS NULL THEN
    RAISE NOTICE 'FEIL: Ingen programmer funnet i databasen';
    RETURN;
  END IF;

  -- Hent en ekte avdeling
  SELECT id INTO v_department_id
  FROM public.departments
  LIMIT 1;

  IF v_department_id IS NULL THEN
    RAISE NOTICE 'FEIL: Ingen avdelinger funnet i databasen';
    RETURN;
  END IF;

  -- Hent en admin bruker
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'FEIL: Ingen admin brukere funnet i databasen';
    RETURN;
  END IF;

  RAISE NOTICE 'Test IDer funnet:';
  RAISE NOTICE '  Program ID: %', v_program_id;
  RAISE NOTICE '  Department ID: %', v_department_id;
  RAISE NOTICE '  Admin ID: %', v_admin_id;

  -- Nå, test funksjonen
  BEGIN
    RAISE NOTICE 'Kaller assign_program_to_department...';

    SELECT public.assign_program_to_department(
      v_program_id,
      v_department_id,
      v_admin_id,
      'TEST - kan slettes'
    ) INTO v_result;

    RAISE NOTICE 'SUKSESS! Assignment ID: %', v_result;

    -- Rull tilbake (slett test-data)
    DELETE FROM public.program_assignments WHERE id = v_result;
    RAISE NOTICE 'Test-data slettet';

  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'FEIL oppstod: %', SQLERRM;
      RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
      RAISE NOTICE 'Detaljer: %', SQLERRM;
  END;
END $$;
