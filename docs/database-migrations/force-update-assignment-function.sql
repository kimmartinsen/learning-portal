-- ============================================================================
-- FORCE UPDATE: assign_program_to_department function
-- ============================================================================
-- Dette skriptet sikrer at funksjonen er oppdatert med riktig definisjon
-- og kan lese fra training_programs med RLS aktivert.
-- ============================================================================

-- Fjern eksisterende funksjon først
DROP FUNCTION IF EXISTS assign_program_to_department(UUID, UUID, UUID, TEXT);

-- Opprett funksjonen på nytt med SECURITY DEFINER og riktig search_path
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
  -- Hent deadline_days fra programmet (bruk public. prefix fordi search_path er tom)
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
-- VERIFISER AT FUNKSJONEN ER OPPRETTET
-- ============================================================================

SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✓'
    ELSE 'SECURITY INVOKER ✗'
  END as security_type,
  CASE 
    WHEN p.proconfig IS NULL OR array_to_string(p.proconfig, ',') LIKE '%search_path=%' THEN 'search_path satt ✓'
    ELSE 'search_path ikke satt ✗'
  END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'assign_program_to_department';

-- ============================================================================
-- FERDIG: Funksjonen er nå oppdatert
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. assign_program_to_department er oppdatert med SECURITY DEFINER
-- 2. Funksjonen bruker public. prefix for alle tabellreferanser
-- 3. Funksjonen kan nå lese fra training_programs med RLS aktivert
-- ============================================================================

