-- Diagnostisk SQL: Sjekk at alle tabeller og funksjoner eksisterer
-- Dato: 2025-11-27
-- Formål: Verifisere databasestruktur før vi kjører fix

-- 1. Sjekk om alle nødvendige tabeller eksisterer
SELECT
  'training_programs' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'training_programs'
  ) as exists;

SELECT
  'program_assignments' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_assignments'
  ) as exists;

SELECT
  'user_departments' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_departments'
  ) as exists;

SELECT
  'departments' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'departments'
  ) as exists;

SELECT
  'profiles' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) as exists;

-- 2. Tell antall records i hver tabell
SELECT 'training_programs' as table_name, COUNT(*) as count FROM public.training_programs;
SELECT 'program_assignments' as table_name, COUNT(*) as count FROM public.program_assignments;
SELECT 'user_departments' as table_name, COUNT(*) as count FROM public.user_departments;
SELECT 'departments' as table_name, COUNT(*) as count FROM public.departments;
SELECT 'profiles' as table_name, COUNT(*) as count FROM public.profiles;

-- 3. Sjekk eksisterende funksjoner
SELECT
  proname as function_name,
  pronamespace::regnamespace as schema,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname IN ('assign_program_to_department', 'assign_program_to_user', 'auto_assign_department_programs');

-- 4. Sjekk triggere
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%assign%';

-- 5. Vis nåværende definisjon av assign_program_to_department (hvis den eksisterer)
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'assign_program_to_department'
LIMIT 1;

-- FORVENTET RESULTAT:
-- Alle tabeller skal eksistere (TRUE)
-- user_departments skal ha records (count > 0)
-- assign_program_to_department skal eksistere
-- Funksjonsdefinisjonen skal vise om den bruker profiles.department_id eller user_departments
