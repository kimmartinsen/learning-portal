-- ============================================================================
-- VERIFY: Assignment Functions Setup
-- ============================================================================
-- Dette skriptet verifiserer at tildelingsfunksjonene er riktig satt opp
-- ============================================================================

-- Sjekk om funksjonene eksisterer og har riktige innstillinger
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('assign_program_to_user', 'assign_program_to_department')
ORDER BY p.proname;

-- Sjekk om funksjonene har SECURITY DEFINER
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
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

-- Sjekk om training_programs tabellen eksisterer og har RLS aktivert
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'training_programs';

-- Sjekk RLS policies på training_programs
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'training_programs'
ORDER BY policyname;

