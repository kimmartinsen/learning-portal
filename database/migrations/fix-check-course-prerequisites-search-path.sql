-- ============================================================================
-- FIX: Mutable Search Path in check_course_prerequisites_met function
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path, som åpner for:
--   - SQL injection via search_path manipulasjon
--   - Ikke-deterministisk oppførsel på tvers av miljøer
--   - Uforutsigbar objektoppløsning
-- 
-- Løsning: Legge til SET search_path = '' for å bruke fullt kvalifiserte navn
-- ============================================================================

-- Drop eksisterende funksjon først
DROP FUNCTION IF EXISTS public.check_course_prerequisites_met(UUID, UUID) CASCADE;

-- Gjenskape funksjonen med SET search_path = ''
CREATE FUNCTION public.check_course_prerequisites_met(
  p_user_id UUID,
  p_program_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prerequisite_type VARCHAR;
  v_prerequisite_course_ids UUID[];
  v_theme_id UUID;
  v_sort_order INTEGER;
  v_previous_program_id UUID;
  v_prerequisites_met BOOLEAN;
BEGIN
  -- Hent kurs-info (bruk public. prefix siden search_path er tom)
  SELECT prerequisite_type, prerequisite_course_ids, theme_id, sort_order
  INTO v_prerequisite_type, v_prerequisite_course_ids, v_theme_id, v_sort_order
  FROM public.training_programs
  WHERE id = p_program_id;

  -- Hvis ingen forutsetninger, returner true
  IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Hvis 'previous_auto' eller 'previous_manual', sjekk forrige kurs i samme tema
  IF v_prerequisite_type IN ('previous_auto', 'previous_manual') THEN
    -- Finn forrige kurs i sekvensen
    SELECT id INTO v_previous_program_id
    FROM public.training_programs
    WHERE theme_id = v_theme_id
      AND sort_order < v_sort_order
    ORDER BY sort_order DESC
    LIMIT 1;

    IF v_previous_program_id IS NULL THEN
      -- Ingen forrige kurs, så dette er første kurs
      RETURN TRUE;
    END IF;

    -- Sjekk om brukeren har fullført forrige kurs
    SELECT EXISTS(
      SELECT 1
      FROM public.program_assignments
      WHERE program_id = v_previous_program_id
        AND assigned_to_user_id = p_user_id
        AND status = 'completed'
    ) INTO v_prerequisites_met;

    RETURN v_prerequisites_met;
  END IF;

  -- Hvis 'specific_courses', sjekk om alle spesifiserte kurs er fullført
  IF v_prerequisite_type = 'specific_courses' THEN
    IF v_prerequisite_course_ids IS NULL OR array_length(v_prerequisite_course_ids, 1) IS NULL THEN
      -- Ingen spesifikke kurs angitt, returner true
      RETURN TRUE;
    END IF;

    -- Sjekk om ALLE angitte kurs er fullført
    SELECT COUNT(*) = array_length(v_prerequisite_course_ids, 1)
    INTO v_prerequisites_met
    FROM public.program_assignments
    WHERE program_id = ANY(v_prerequisite_course_ids)
      AND assigned_to_user_id = p_user_id
      AND status = 'completed';

    RETURN v_prerequisites_met;
  END IF;

  -- Default: returner false hvis ukjent type
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- VIKTIG: Denne funksjonen brukes av andre funksjoner:
--   - calculate_course_status_from_prerequisites
-- Sørg for at disse også har SET search_path = '' 
-- (se fix-function-search-path-security.sql for full fix)
-- ============================================================================

