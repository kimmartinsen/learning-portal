-- ============================================================================
-- FIX: Training Programs RLS Policies
-- ============================================================================
-- Dette skriptet sikrer at RLS-policies for training_programs er riktig satt opp
-- slik at admins kan opprette, oppdatere og slette kurs.
-- ============================================================================

-- ============================================================================
-- 1. SIKRE AT RLS ER AKTIVERT PÅ TRAINING_PROGRAMS
-- ============================================================================

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. FJERN ALLE EKSISTERENDE POLICIES FOR Å STARTE PÅ NYTT
-- ============================================================================

DROP POLICY IF EXISTS "Users view company programs" ON public.training_programs;
DROP POLICY IF EXISTS "Admins manage all programs" ON public.training_programs;
DROP POLICY IF EXISTS "Instructors manage own programs" ON public.training_programs;

-- ============================================================================
-- 3. OPPRETT POLICIES MED SECURITY DEFINER FUNKSJONER FOR Å UNNGÅ REKURSJON
-- ============================================================================

-- Bruk funksjonen vi allerede har for å sjekke admin-status
-- (fra fix-complete-rls-for-login.sql)

-- Policy 1: Users view company programs
CREATE POLICY "Users view company programs" ON public.training_programs FOR SELECT 
  USING (
    company_id = public.get_user_company_id(auth.uid())
  );

-- Policy 2: Admins manage all programs (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins manage all programs" ON public.training_programs FOR ALL 
  USING (
    public.is_user_admin_for_company(auth.uid(), company_id)
  );

-- Policy 3: Instructors manage own programs (INSERT, UPDATE, DELETE for courses they instruct)
CREATE POLICY "Instructors manage own programs" ON public.training_programs FOR ALL 
  USING (
    instructor_id = auth.uid()
  );

-- ============================================================================
-- 4. VERIFISER AT POLICIES ER OPPRETTET
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'training_programs';
  
  IF v_policy_count < 3 THEN
    RAISE WARNING 'Forventet 3 policies på training_programs, fant %', v_policy_count;
  ELSE
    RAISE NOTICE 'Alle policies er opprettet på training_programs tabellen';
  END IF;
END $$;

-- ============================================================================
-- FERDIG: RLS-policies er nå riktig satt opp for training_programs
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Admins skal kunne opprette, oppdatere og slette kurs
-- 2. Instruktører skal kunne oppdatere kurs de er ansvarlig for
-- 3. Alle brukere skal kunne se kurs i sin bedrift
-- ============================================================================

