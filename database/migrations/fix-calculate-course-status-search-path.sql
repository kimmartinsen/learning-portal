-- ============================================================================
-- FIX: Mutable Search Path in calculate_course_status_from_prerequisites
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path, som åpner for:
--   - SQL injection via search_path manipulasjon
--   - Ikke-deterministisk oppførsel på tvers av miljøer
--   - Uforutsigbar objektoppløsning
-- 
-- Løsning: Legge til SET search_path = '' og bruke fullt kvalifiserte navn
-- ============================================================================

-- Drop eksisterende funksjon først
DROP FUNCTION IF EXISTS public.calculate_course_status_from_prerequisites(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_course_status_from_prerequisites(UUID, UUID, VARCHAR) CASCADE;

-- Gjenskape funksjonen med SET search_path = ''
CREATE FUNCTION public.calculate_course_status_from_prerequisites(
  p_user_id UUID,
  p_program_id UUID,
  p_current_status VARCHAR DEFAULT 'assigned'
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prerequisite_type VARCHAR;
  v_prerequisites_met BOOLEAN;
BEGIN
  -- Hent prerequisite type (bruk public. prefix siden search_path er tom)
  SELECT prerequisite_type INTO v_prerequisite_type
  FROM public.training_programs
  WHERE id = p_program_id;

  -- Hvis kurset allerede er completed/started, ikke endre status
  IF p_current_status IN ('completed', 'in_progress', 'started') THEN
    RETURN p_current_status;
  END IF;

  -- Hvis ingen forutsetninger, returner assigned
  IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
    RETURN 'assigned';
  END IF;

  -- Sjekk om forutsetninger er oppfylt
  -- VIKTIG: Denne funksjonen kaller check_course_prerequisites_met
  -- som også må ha SET search_path = ''
  v_prerequisites_met := public.check_course_prerequisites_met(p_user_id, p_program_id);

  IF NOT v_prerequisites_met THEN
    -- Forutsetninger ikke oppfylt, kurset er låst
    RETURN 'locked';
  END IF;

  -- Forutsetninger oppfylt
  IF v_prerequisite_type = 'previous_manual' THEN
    -- Manuell godkjenning kreves
    IF p_current_status = 'locked' THEN
      RETURN 'pending'; -- Venter på admin godkjenning
    ELSE
      RETURN p_current_status; -- Beholder eksisterende status hvis allerede godkjent
    END IF;
  ELSE
    -- Auto eller specific_courses: lås opp automatisk
    RETURN 'assigned';
  END IF;
END;
$$;

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

