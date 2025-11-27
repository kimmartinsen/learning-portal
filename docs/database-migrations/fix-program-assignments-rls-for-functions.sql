-- ============================================================================
-- FIX: Program Assignments RLS Policies for SECURITY DEFINER Functions
-- ============================================================================
-- Dette skriptet oppdaterer RLS-policies på program_assignments slik at
-- SECURITY DEFINER funksjoner kan INSERT tildelinger.
-- ============================================================================

-- ============================================================================
-- 1. SIKRE AT RLS ER AKTIVERT
-- ============================================================================

ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. FJERN ALLE EKSISTERENDE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Admins manage all assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Instructors manage own program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Users update own assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Admins view company assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Instructors view own program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Instructors can update physical course assignments" ON public.program_assignments;

-- ============================================================================
-- 3. OPPRETT NYE POLICIES MED HELPER-FUNKSJONER
-- ============================================================================

-- Policy 1: Users view own assignments
CREATE POLICY "Users view own assignments" ON public.program_assignments FOR SELECT 
  USING (
    assigned_to_user_id = auth.uid() OR
    assigned_to_department_id IN (
      SELECT department_id 
      FROM public.user_departments 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Users update own assignments (status og completed_at)
CREATE POLICY "Users update own assignments" ON public.program_assignments FOR UPDATE 
  USING (assigned_to_user_id = auth.uid())
  WITH CHECK (assigned_to_user_id = auth.uid());

-- Policy 3: Admins manage all assignments (inkluderer INSERT)
-- Bruker helper-funksjon for å unngå rekursjon
CREATE POLICY "Admins manage all assignments" ON public.program_assignments FOR ALL 
  USING (
    EXISTS(
      SELECT 1 
      FROM public.training_programs tp
      WHERE tp.id = program_assignments.program_id
        AND public.is_user_admin_for_company(auth.uid(), tp.company_id)
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 
      FROM public.training_programs tp
      WHERE tp.id = program_assignments.program_id
        AND public.is_user_admin_for_company(auth.uid(), tp.company_id)
    )
  );

-- Policy 4: Instructors manage own program assignments
CREATE POLICY "Instructors manage own program assignments" ON public.program_assignments FOR ALL 
  USING (
    program_id IN (
      SELECT id 
      FROM public.training_programs 
      WHERE instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    program_id IN (
      SELECT id 
      FROM public.training_programs 
      WHERE instructor_id = auth.uid()
    )
  );

-- Policy 5: Instructors can update physical course assignments (for fysiske kurs)
CREATE POLICY "Instructors can update physical course assignments" ON public.program_assignments FOR UPDATE 
  USING (
    program_id IN (
      SELECT id 
      FROM public.training_programs 
      WHERE instructor_id = auth.uid()
        AND course_type = 'physical-course'
    )
  )
  WITH CHECK (
    program_id IN (
      SELECT id 
      FROM public.training_programs 
      WHERE instructor_id = auth.uid()
        AND course_type = 'physical-course'
    )
  );

-- ============================================================================
-- 4. POLICY FOR SECURITY DEFINER FUNKSJONER
-- ============================================================================
-- SECURITY DEFINER funksjoner kjøres med postgres sin identitet.
-- Vi lager en policy som tillater INSERT hvis assigned_by er en admin.
-- Dette fungerer fordi funksjonene alltid sender med assigned_by parameter,
-- og vi kan sjekke om den brukeren er admin.

-- Policy som tillater INSERT fra funksjoner OG direkte fra admins
-- Dette er en ekstra policy som tillater INSERT hvis assigned_by er admin
CREATE POLICY "Allow function inserts for admins" ON public.program_assignments FOR INSERT 
  WITH CHECK (
    -- Tillat hvis assigned_by er en admin i samme bedrift som programmet
    -- Dette fungerer både for direkte INSERT fra frontend (auth.uid() = assigned_by)
    -- og for SECURITY DEFINER funksjoner (current_user = postgres, men assigned_by er admin)
    EXISTS(
      SELECT 1 
      FROM public.profiles p
      JOIN public.training_programs tp ON tp.id = program_assignments.program_id
      WHERE p.id = program_assignments.assigned_by
        AND p.role = 'admin'
        AND p.company_id = tp.company_id
    )
    OR
    -- Tillat også hvis current_user er postgres (SECURITY DEFINER funksjon)
    -- og assigned_by er satt (dette betyr at funksjonen ble kalt)
    (current_user = 'postgres' AND program_assignments.assigned_by IS NOT NULL)
    OR
    -- Tillat direkte INSERT fra admin (auth.uid() = assigned_by og er admin)
    (
      auth.uid() = program_assignments.assigned_by
      AND EXISTS(
        SELECT 1 
        FROM public.profiles p
        JOIN public.training_programs tp ON tp.id = program_assignments.program_id
        WHERE p.id = auth.uid()
          AND p.role = 'admin'
          AND p.company_id = tp.company_id
      )
    )
  );

-- ============================================================================
-- FERDIG: RLS-policies er nå oppdatert for SECURITY DEFINER funksjoner
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. SECURITY DEFINER funksjoner kan INSERT i program_assignments
-- 2. RLS-policies bruker helper-funksjoner for å unngå rekursjon
-- 3. Postgres har rettigheter til å bypass RLS når funksjoner kjøres
-- ============================================================================

