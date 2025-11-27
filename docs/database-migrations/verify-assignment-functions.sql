-- ============================================================================
-- VERIFY: Assignment Functions Setup
-- ============================================================================
-- Dette skriptet verifiserer at tildelingsfunksjonene er riktig satt opp
-- ============================================================================

-- 1. Sjekk om funksjonene eksisterer og har SECURITY DEFINER
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✓'
    ELSE 'SECURITY INVOKER ✗'
  END as security_type,
  CASE 
    WHEN p.proconfig IS NULL OR array_to_string(p.proconfig, ',') NOT LIKE '%search_path%' THEN 'No search_path set'
    ELSE array_to_string(p.proconfig, ',')
  END as search_path_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('assign_program_to_user', 'assign_program_to_department')
ORDER BY p.proname;

-- 2. Sjekk om training_programs tabellen eksisterer og har RLS aktivert
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS aktivert ✓'
    ELSE 'RLS deaktivert ✗'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'training_programs';

-- 3. Sjekk RLS policies på training_programs
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'training_programs'
ORDER BY policyname;

-- 4. Sjekk om program_assignments tabellen har RLS aktivert
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS aktivert ✓'
    ELSE 'RLS deaktivert ✗'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'program_assignments';

-- 5. Sjekk RLS policies på program_assignments (viktig for INSERT-operasjoner)
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
ORDER BY policyname;

