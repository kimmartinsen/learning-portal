-- ============================================================================
-- FIX: Ensure assign_program_to_department can INSERT user assignments
-- ============================================================================
-- Dette skriptet sikrer at RPC-funksjonen assign_program_to_department
-- kan opprette brukertildelinger, selv med RLS aktivert.
-- ============================================================================

-- ============================================================================
-- 1. SIKRE AT FUNKSJONEN HAR SECURITY DEFINER
-- ============================================================================

-- Oppdater funksjonen for å sikre at den har SECURITY DEFINER
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
  v_insert_count INTEGER := 0;
BEGIN
  -- Hent deadline_days fra programmet
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
        
        GET DIAGNOSTICS v_insert_count = ROW_COUNT;
        IF v_insert_count > 0 THEN
          v_insert_count := v_insert_count + 1;
        END IF;
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
-- 2. SIKRE AT RLS-POLICY TILLATER INSERT FRA SECURITY DEFINER FUNKSJONER
-- ============================================================================

-- Oppdater policyen for å sikre at den tillater INSERT fra postgres (SECURITY DEFINER)
DROP POLICY IF EXISTS "Allow function inserts for admins" ON public.program_assignments;

CREATE POLICY "Allow function inserts for admins" ON public.program_assignments FOR INSERT 
  WITH CHECK (
    -- Tillat hvis current_user er postgres (SECURITY DEFINER funksjon)
    -- Dette er den viktigste sjekken for funksjoner
    current_user = 'postgres'
    OR
    -- Tillat hvis assigned_by er en admin i samme bedrift som programmet
    EXISTS(
      SELECT 1 
      FROM public.profiles p
      JOIN public.training_programs tp ON tp.id = program_assignments.program_id
      WHERE p.id = program_assignments.assigned_by
        AND p.role = 'admin'
        AND p.company_id = tp.company_id
    )
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
-- FERDIG: Funksjonen og RLS-policyen er nå oppdatert
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. assign_program_to_department har SECURITY DEFINER og kan INSERT
-- 2. RLS-policyen tillater INSERT fra postgres (SECURITY DEFINER funksjoner)
-- 3. Funksjonen håndterer feil gracefully og fortsetter med neste bruker
-- ============================================================================

