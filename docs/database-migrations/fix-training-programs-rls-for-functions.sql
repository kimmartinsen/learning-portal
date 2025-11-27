-- ============================================================================
-- FIX: Training Programs RLS Policies for SECURITY DEFINER Functions
-- ============================================================================
-- Dette skriptet sikrer at SECURITY DEFINER funksjoner kan lese fra
-- training_programs tabellen, selv med RLS aktivert.
-- ============================================================================

-- ============================================================================
-- 1. SIKRE AT RLS ER AKTIVERT
-- ============================================================================

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. OPPDATER EKSISTERENDE SELECT POLICY FOR Å TILLATE POSTGRES
-- ============================================================================

-- Fjern eksisterende "Users view company programs" policy
DROP POLICY IF EXISTS "Users view company programs" ON public.training_programs;

-- Opprett ny policy som tillater både postgres (SECURITY DEFINER) og normale brukere
CREATE POLICY "Users view company programs" ON public.training_programs FOR SELECT 
  USING (
    -- Tillat hvis current_user er postgres (SECURITY DEFINER funksjon)
    -- Dette er viktig for at assign_program_to_department kan lese deadline_days
    current_user = 'postgres'
    OR
    -- Tillat normale brukere (eksisterende policy)
    company_id = public.get_user_company_id(auth.uid())
  );

-- ============================================================================
-- FERDIG: RLS-policies er nå oppdatert for SECURITY DEFINER funksjoner
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. SECURITY DEFINER funksjoner kan lese fra training_programs
-- 2. Normale brukere kan fortsatt se kurs i sin bedrift
-- 3. assign_program_to_department kan nå hente deadline_days uten feil
-- ============================================================================

