-- STEG-FOR-STEG FIX
-- Kjør disse et om gangen og se hva som skjer

-- ============================================
-- STEG 1: List alle triggers på program_assignments
-- ============================================
SELECT
  trigger_name,
  event_manipulation as when_triggered,
  action_timing as timing,
  action_statement as trigger_function
FROM information_schema.triggers
WHERE event_object_table = 'program_assignments'
  AND trigger_schema = 'public'
ORDER BY trigger_name;

-- PAUSE HER! Se outputen. Er det noen triggers?
-- Hvis JA, gå videre til steg 2
-- Hvis NEI, problemet er ikke triggers - hopp til steg 5


-- ============================================
-- STEG 2: Se hva triggerene gjør
-- ============================================
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'program_assignments'
  AND p.pronamespace = 'public'::regnamespace;

-- PAUSE HER! Les funksjonsdefinisjonene.
-- Søk etter "training_programs" i outputen.
-- Hvis du ser det, DET er triggeren som feiler!


-- ============================================
-- STEG 3: Disable ALLE user triggers
-- ============================================
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'program_assignments'
      AND trigger_schema = 'public'
      AND trigger_name NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    BEGIN
      EXECUTE 'ALTER TABLE public.program_assignments DISABLE TRIGGER ' || quote_ident(trigger_record.trigger_name);
      RAISE NOTICE 'Disabled trigger: %', trigger_record.trigger_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not disable: % - Error: %', trigger_record.trigger_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- PAUSE HER! Du skal se meldinger om hvilke triggers ble disabled.


-- ============================================
-- STEG 4: Verifiser at triggers er disabled
-- ============================================
SELECT
  t.tgname as trigger_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'program_assignments'
  AND t.tgname NOT LIKE 'RI_ConstraintTrigger%'
ORDER BY t.tgname;

-- PAUSE HER! Alle skal vise "DISABLED"


-- ============================================
-- STEG 5: Test INSERT direkte
-- ============================================
DO $$
DECLARE
  v_test_id UUID;
  v_program_id UUID;
  v_dept_id UUID;
  v_user_id UUID;
BEGIN
  -- Hent test-data
  SELECT id INTO v_program_id FROM public.training_programs LIMIT 1;
  SELECT id INTO v_dept_id FROM public.departments LIMIT 1;
  SELECT id INTO v_user_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  IF v_program_id IS NULL OR v_dept_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'FEIL: Mangler test-data i databasen';
    RETURN;
  END IF;

  -- Test INSERT
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
    ) RETURNING id INTO v_test_id;

    RAISE NOTICE '✅ SUKSESS! Assignment opprettet med ID: %', v_test_id;

    -- Slett test-data
    DELETE FROM public.program_assignments WHERE id = v_test_id;
    RAISE NOTICE '✅ Test-data slettet';

  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ FEIL: %', SQLERRM;
      RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
  END;
END $$;

-- FERDIG!
-- Hvis du får "✅ SUKSESS" her, gå til frontend og test kurstildeling!
-- Hvis du får "❌ FEIL", send meg hele feilmeldingen.
