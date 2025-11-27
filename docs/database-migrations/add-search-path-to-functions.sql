-- Migrering: Legg til SET search_path på eksisterende funksjoner
-- Dato: 2025-11-27
-- Formål: Fikse "relation does not exist" feil ved å sette search_path eksplisitt

-- Dette er problemet: SECURITY DEFINER funksjoner uten SET search_path
-- kan få feil search_path når de kalles fra Supabase RPC.

-- LØSNING: Bruk ALTER FUNCTION for å sette search_path

-- 1. Sett search_path på assign_program_to_department
ALTER FUNCTION public.assign_program_to_department(UUID, UUID, UUID, TEXT)
  SET search_path = public, pg_temp;

-- 2. Sett search_path på assign_program_to_user
ALTER FUNCTION public.assign_program_to_user(UUID, UUID, UUID, TEXT)
  SET search_path = public, pg_temp;

-- 3. Sett search_path på auto_assign_department_programs (hvis den eksisterer)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'auto_assign_department_programs'
  ) THEN
    ALTER FUNCTION public.auto_assign_department_programs()
      SET search_path = public, pg_temp;
    RAISE NOTICE 'search_path satt for auto_assign_department_programs';
  END IF;
END $$;

-- 4. Verifiser at search_path er satt
SELECT
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proconfig as config_settings
FROM pg_proc p
WHERE p.proname IN ('assign_program_to_department', 'assign_program_to_user', 'auto_assign_department_programs')
  AND p.pronamespace = 'public'::regnamespace;

-- FORVENTET RESULTAT:
-- config_settings kolonnen skal vise: {search_path=public,pg_temp}
-- Dette betyr at funksjonen vil alltid bruke 'public' schema

-- VIKTIG:
-- Etter at du har kjørt denne SQL-en, skal kursTildelinger fungere!
-- Test ved å:
-- 1. Opprett et nytt kurs
-- 2. Tildel det til en avdeling
-- 3. Verifiser at brukerne i avdelingen får kurset
