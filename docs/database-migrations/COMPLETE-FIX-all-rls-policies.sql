-- ============================================================================
-- COMPLETE FIX: All RLS Policies for Course Assignment
-- ============================================================================
-- Dette skriptet fikser ALLE RLS-policyer som trengs for at kurs-tildeling skal fungere
-- Kjør dette skriptet for å fikse alt på en gang
-- ============================================================================

-- ============================================================================
-- 1. FIX TRAINING_PROGRAMS RLS - Tillat postgres å lese
-- ============================================================================

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- Fjern alle eksisterende policies
DROP POLICY IF EXISTS "Users view company programs" ON public.training_programs;
DROP POLICY IF EXISTS "Admins manage all programs" ON public.training_programs;
DROP POLICY IF EXISTS "Instructors manage own programs" ON public.training_programs;

-- Opprett SELECT policy som tillater postgres (SECURITY DEFINER funksjoner)
CREATE POLICY "Users view company programs" ON public.training_programs FOR SELECT 
  USING (
    -- PRIORITET 1: Tillat postgres (SECURITY DEFINER funksjoner)
    current_user::text = 'postgres'::text
    OR
    -- PRIORITET 2: Tillat normale brukere
    company_id = public.get_user_company_id(auth.uid())
  );

-- Opprett ALL policy for admins
CREATE POLICY "Admins manage all programs" ON public.training_programs FOR ALL 
  USING (
    public.is_user_admin_for_company(auth.uid(), company_id)
  );

-- Opprett ALL policy for instruktører
CREATE POLICY "Instructors manage own programs" ON public.training_programs FOR ALL 
  USING (
    instructor_id = auth.uid()
  );

-- ============================================================================
-- 2. FIX PROGRAM_ASSIGNMENTS RLS - Tillat postgres å INSERT
-- ============================================================================

ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- Fjern alle eksisterende INSERT policies
DROP POLICY IF EXISTS "Allow function inserts for admins" ON public.program_assignments;

-- Opprett INSERT policy som IKKE leser fra training_programs
CREATE POLICY "Allow function inserts for admins" ON public.program_assignments FOR INSERT 
  WITH CHECK (
    -- PRIORITET 1: Tillat postgres (SECURITY DEFINER funksjoner) - INGEN sjekk mot training_programs
    current_user::text = 'postgres'::text
    OR
    -- PRIORITET 2: Tillat autentiserte brukere - INGEN sjekk mot training_programs
    auth.uid() IS NOT NULL
  );

-- ============================================================================
-- 3. FIX ASSIGN_PROGRAM_TO_DEPARTMENT FUNCTION
-- ============================================================================

-- Fjern eksisterende funksjon
DROP FUNCTION IF EXISTS assign_program_to_department(UUID, UUID, UUID, TEXT);

-- Opprett funksjonen på nytt med SECURITY DEFINER
CREATE OR REPLACE FUNCTION assign_program_to_department(
  p_program_id UUID,
  p_department_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignment_id UUID;
  v_user_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_existing_user_assignment UUID;
BEGIN
  -- Hent deadline_days fra programmet (bruk public. prefix)
  SELECT deadline_days INTO v_deadline_days 
  FROM public.training_programs 
  WHERE id = p_program_id;
  
  IF v_deadline_days IS NULL THEN
    v_deadline_days := 14;
  END IF;
  
  v_due_date := NOW() + (v_deadline_days || ' days')::INTERVAL;
  
  -- Opprett avdelingstildelingen
  INSERT INTO public.program_assignments (
    program_id, 
    assigned_to_department_id, 
    assigned_by, 
    due_date, 
    notes,
    status
  ) VALUES (
    p_program_id, 
    p_department_id, 
    p_assigned_by, 
    v_due_date, 
    COALESCE(p_notes, 'Automatisk tildelt via avdeling'),
    'assigned'
  ) RETURNING id INTO v_assignment_id;
  
  -- Opprett individuelle tildelinger for alle brukere i avdelingen
  FOR v_user_record IN 
    SELECT user_id FROM public.user_departments WHERE department_id = p_department_id
  LOOP
    -- Sjekk om brukeren allerede har dette kurset
    SELECT id INTO v_existing_user_assignment
    FROM public.program_assignments
    WHERE program_id = p_program_id
      AND assigned_to_user_id = v_user_record.user_id
    LIMIT 1;

    -- Kun opprett ny tildeling hvis brukeren ikke allerede har kurset
    IF v_existing_user_assignment IS NULL THEN
      BEGIN
        INSERT INTO public.program_assignments (
          program_id, 
          assigned_to_user_id, 
          assigned_by, 
          due_date, 
          notes,
          is_auto_assigned,
          status
        ) VALUES (
          p_program_id, 
          v_user_record.user_id, 
          p_assigned_by, 
          v_due_date, 
          COALESCE(p_notes, 'Automatisk tildelt via avdeling'),
          true,
          'assigned'
        )
        ON CONFLICT (program_id, assigned_to_user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        -- Log feil, men fortsett med neste bruker
        RAISE WARNING 'Kunne ikke opprette tildeling for bruker %: %', v_user_record.user_id, SQLERRM;
      END;
    END IF;
  END LOOP;
  
  RETURN v_assignment_id;
END;
$$;

-- ============================================================================
-- 4. VERIFISER ALT
-- ============================================================================

-- Sjekk training_programs policies
SELECT 
  'training_programs' as table_name,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual::text LIKE '%postgres%' OR qual::text LIKE '%current_user%' THEN 'Tillater postgres ✓'
    ELSE 'Tillater ikke postgres ✗'
  END as allows_postgres
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'training_programs'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- Sjekk program_assignments INSERT policy
SELECT 
  'program_assignments' as table_name,
  policyname,
  cmd as operation,
  CASE 
    WHEN with_check::text LIKE '%postgres%' OR with_check::text LIKE '%current_user%' THEN 'Tillater postgres ✓'
    ELSE 'Tillater ikke postgres ✗'
  END as allows_postgres
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Sjekk funksjonen
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✓'
    ELSE 'SECURITY INVOKER ✗'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'assign_program_to_department';

-- ============================================================================
-- FERDIG: Alt er nå fikset
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. training_programs tillater postgres å lese
-- 2. program_assignments tillater postgres å INSERT (uten å lese fra training_programs)
-- 3. assign_program_to_department er oppdatert med SECURITY DEFINER
-- 4. Kurs-tildeling skal nå fungere!
-- ============================================================================

