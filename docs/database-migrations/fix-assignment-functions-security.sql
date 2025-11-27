-- ============================================================================
-- FIX: Assignment Functions Security
-- ============================================================================
-- Dette skriptet legger til SECURITY DEFINER på tildelingsfunksjonene
-- slik at de kan lese fra training_programs selv med RLS aktivert.
-- ============================================================================

-- ============================================================================
-- 1. OPPDATER assign_program_to_user
-- ============================================================================

DROP FUNCTION IF EXISTS assign_program_to_user(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION assign_program_to_user(
  p_program_id UUID,
  p_user_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignment_id UUID;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- Hent deadline_days fra programmet
  SELECT deadline_days INTO v_deadline_days 
  FROM public.training_programs 
  WHERE id = p_program_id;
  
  v_due_date := NOW() + (COALESCE(v_deadline_days, 14) || ' days')::INTERVAL;
  
  -- Opprett tildeling
  INSERT INTO public.program_assignments (
    program_id, 
    assigned_to_user_id, 
    assigned_by, 
    due_date, 
    notes
  ) VALUES (
    p_program_id, 
    p_user_id, 
    p_assigned_by, 
    v_due_date, 
    p_notes
  ) RETURNING id INTO v_assignment_id;
  
  RETURN v_assignment_id;
END;
$$;

-- ============================================================================
-- 2. OPPDATER assign_program_to_department
-- ============================================================================

DROP FUNCTION IF EXISTS assign_program_to_department(UUID, UUID, UUID, TEXT);

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
  -- Hent deadline_days fra programmet
  SELECT deadline_days INTO v_deadline_days 
  FROM public.training_programs 
  WHERE id = p_program_id;
  
  v_due_date := NOW() + (COALESCE(v_deadline_days, 14) || ' days')::INTERVAL;
  
  -- Opprett avdelingstildelingen
  INSERT INTO public.program_assignments (
    program_id, 
    assigned_to_department_id, 
    assigned_by, 
    due_date, 
    notes
  ) VALUES (
    p_program_id, 
    p_department_id, 
    p_assigned_by, 
    v_due_date, 
    p_notes
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
      INSERT INTO public.program_assignments (
        program_id, 
        assigned_to_user_id, 
        assigned_by, 
        due_date, 
        notes,
        is_auto_assigned
      ) VALUES (
        p_program_id, 
        v_user_record.user_id, 
        p_assigned_by, 
        v_due_date, 
        p_notes,
        true
      );
    END IF;
  END LOOP;
  
  RETURN v_assignment_id;
END;
$$;

-- ============================================================================
-- 3. GI FUNKSJONENE EKSPLISITTE RETTIGHETER
-- ============================================================================

-- Gi funksjonene rettigheter til å lese fra training_programs
-- (Dette er nødvendig selv med SECURITY DEFINER i noen tilfeller)
GRANT SELECT ON public.training_programs TO postgres;
GRANT SELECT ON public.user_departments TO postgres;
GRANT INSERT, SELECT ON public.program_assignments TO postgres;

-- ============================================================================
-- 4. VERIFISER AT FUNKSJONENE ER OPPRETTET
-- ============================================================================

DO $$
DECLARE
  v_func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('assign_program_to_user', 'assign_program_to_department')
    AND p.prosecdef = true; -- SECURITY DEFINER
  
  IF v_func_count < 2 THEN
    RAISE WARNING 'Forventet 2 SECURITY DEFINER funksjoner, fant %', v_func_count;
  ELSE
    RAISE NOTICE 'Alle tildelingsfunksjoner er opprettet med SECURITY DEFINER';
  END IF;
END $$;

-- ============================================================================
-- FERDIG: Tildelingsfunksjonene har nå SECURITY DEFINER
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Funksjonene kan lese fra training_programs selv med RLS aktivert
-- 2. Tildelinger skal nå lagres korrekt når kurs opprettes
-- ============================================================================

