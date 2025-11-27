-- Test: Sjekk nåværende tilstand av assign_program_to_department funksjonen
-- Dato: 2025-11-27
-- Formål: Verifiser om funksjonen bruker profiles.department_id eller user_departments

-- 1. Vis nåværende funksjonsdefinisjon
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'assign_program_to_department';

-- 2. Sjekk om user_departments tabellen eksisterer
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_departments'
) as user_departments_exists;

-- 3. Tell antall brukere i user_departments vs profiles.department_id
SELECT
  (SELECT COUNT(*) FROM user_departments) as users_in_user_departments,
  (SELECT COUNT(*) FROM profiles WHERE department_id IS NOT NULL) as users_with_department_id;

-- 4. Sjekk om profiles.department_id kolonnen fortsatt eksisterer
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'department_id';

-- FORVENTET RESULTAT HVIS PROBLEMET EKSISTERER:
-- - user_departments tabellen eksisterer (TRUE)
-- - Det er brukere i user_departments (> 0)
-- - profiles.department_id kolonnen kan fortsatt eksistere MEN funksjonen skal bruke user_departments
-- - Funksjonsdefinisjonen viser "SELECT id FROM profiles WHERE department_id = p_department_id"
--   (Dette er FEIL - burde være "SELECT user_id FROM user_departments WHERE department_id = p_department_id")
