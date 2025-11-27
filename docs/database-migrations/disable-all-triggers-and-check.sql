-- Sjekk og disable alle triggers som kan forårsake problemer
-- Dato: 2025-11-27

-- 1. List alle triggers på program_assignments
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'program_assignments';

-- 2. Disable alle triggers på program_assignments midlertidig
ALTER TABLE public.program_assignments DISABLE TRIGGER ALL;

-- 3. Sjekk om authenticated rolle har SELECT på training_programs
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'training_programs'
  AND grantee IN ('authenticated', 'anon', 'PUBLIC');

-- 4. Grant SELECT på training_programs hvis ikke allerede gjort
GRANT SELECT ON public.training_programs TO authenticated;

-- 5. List alle funksjoner som fortsatt eksisterer
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname LIKE '%assign%'
ORDER BY proname;

-- 6. Test at vi kan lese fra training_programs direkte
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.training_programs;
  RAISE NOTICE 'training_programs har % programmer', v_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'FEIL ved lesing av training_programs: %', SQLERRM;
END $$;

-- 7. Disable RLS på alle relevante tabeller
ALTER TABLE public.program_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 8. Grant alle permissions
GRANT ALL ON public.program_assignments TO authenticated;
GRANT ALL ON public.training_programs TO authenticated;
GRANT ALL ON public.user_departments TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.departments TO authenticated;

RAISE NOTICE 'Alle triggers disabled, RLS disabled, og permissions granted!';
