-- ============================================================================
-- FIX: Mutable Search Path in get_next_course_in_program function
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path
-- Løsning: Legge til SET search_path = '' og bruke public. prefix
-- ============================================================================

-- Drop eksisterende funksjoner (begge signaturer)
DROP FUNCTION IF EXISTS public.get_next_course_in_program(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_course_in_program(UUID, UUID) CASCADE;

-- Gjenskape funksjonen med SET search_path = '' og public. prefix
CREATE FUNCTION public.get_next_course_in_program(
  p_program_id UUID,
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_next_course_id UUID;
BEGIN
  -- Finn neste kurs i sekvensen som ikke er fullført
  SELECT tp.id INTO v_next_course_id
  FROM public.training_programs tp
  WHERE tp.theme_id = (SELECT theme_id FROM public.training_programs WHERE id = p_program_id)
    AND tp.sort_order > (SELECT sort_order FROM public.training_programs WHERE id = p_program_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.program_assignments pa
      WHERE pa.program_id = tp.id
        AND pa.assigned_to_user_id = p_user_id
        AND pa.status = 'completed'
    )
  ORDER BY tp.sort_order ASC
  LIMIT 1;
  
  RETURN v_next_course_id;
END;
$$;

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

