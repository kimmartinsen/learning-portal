-- ============================================================================
-- FIX: Program Assignments INSERT Policy for SECURITY DEFINER Functions
-- ============================================================================
-- Dette skriptet oppdaterer RLS-policyen for INSERT i program_assignments
-- slik at SECURITY DEFINER funksjoner kan INSERT uten å lese fra training_programs
-- ============================================================================

-- Fjern eksisterende policy
DROP POLICY IF EXISTS "Allow function inserts for admins" ON public.program_assignments;

-- Opprett ny policy som prioriterer postgres (SECURITY DEFINER funksjoner)
CREATE POLICY "Allow function inserts for admins" ON public.program_assignments FOR INSERT 
  WITH CHECK (
    -- PRIORITET 1: Tillat hvis current_user er postgres (SECURITY DEFINER funksjon)
    -- Dette unngår å lese fra training_programs og er den raskeste sjekken
    current_user = 'postgres'
    OR
    -- PRIORITET 2: Tillat direkte INSERT fra admin (auth.uid() = assigned_by og er admin)
    -- Dette unngår å lese fra training_programs hvis mulig
    (
      auth.uid() = program_assignments.assigned_by
      AND EXISTS(
        SELECT 1 
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
      )
      AND EXISTS(
        SELECT 1 
        FROM public.training_programs tp
        WHERE tp.id = program_assignments.program_id
          AND tp.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      )
    )
    OR
    -- PRIORITET 3: Fallback - Tillat hvis assigned_by er en admin i samme bedrift som programmet
    -- Dette er for SECURITY DEFINER funksjoner som ikke kjører som postgres
    EXISTS(
      SELECT 1 
      FROM public.profiles p
      JOIN public.training_programs tp ON tp.id = program_assignments.program_id
      WHERE p.id = program_assignments.assigned_by
        AND p.role = 'admin'
        AND p.company_id = tp.company_id
    )
  );

-- ============================================================================
-- VERIFISER AT POLICYEN ER OPPRETTET
-- ============================================================================

SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN with_check::text LIKE '%current_user = ''postgres''%' THEN 'Tillater postgres ✓'
    ELSE 'Tillater ikke postgres ✗'
  END as allows_postgres
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
  AND cmd = 'INSERT'
  AND policyname = 'Allow function inserts for admins';

-- ============================================================================
-- FERDIG: RLS-policyen er nå oppdatert
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. SECURITY DEFINER funksjoner (postgres) kan INSERT i program_assignments
-- 2. Policyen prioriterer postgres-sjekken først, slik at den ikke trenger å lese fra training_programs
-- 3. Dette skal løse "relation 'training_programs' does not exist" feilen
-- ============================================================================

