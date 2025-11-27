-- Finn og disable problematiske triggers
-- Dato: 2025-11-27

-- 1. List ALLE triggers på program_assignments
SELECT
  trigger_name,
  event_manipulation as when_triggered,
  action_timing as timing,
  action_orientation as for_each,
  action_statement as trigger_function
FROM information_schema.triggers
WHERE event_object_table = 'program_assignments'
ORDER BY trigger_name;

-- 2. Vis funksjonsdefinisjonene for alle trigger-funksjoner
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'program_assignments'
  AND p.pronamespace = 'public'::regnamespace;

-- 3. Disable ALLE user triggers på program_assignments (ikke system triggers)
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'program_assignments'
      AND trigger_schema = 'public'
      -- Skip system triggers (de som starter med RI_ConstraintTrigger)
      AND trigger_name NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    BEGIN
      EXECUTE 'ALTER TABLE public.program_assignments DISABLE TRIGGER ' || quote_ident(trigger_record.trigger_name);
      RAISE NOTICE 'Disabled trigger: %', trigger_record.trigger_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not disable trigger %: %', trigger_record.trigger_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Verifiser hvilke triggers som er disabled
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

-- enabled_status:
-- 'O' = trigger is enabled
-- 'D' = trigger is disabled

-- FERDIG! Alle user-defined triggers er nå disabled.
-- Test kurstildeling igjen!
