-- ============================================================================
-- FIX: Mutable Search Path in handle_course_completion function
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path, som åpner for:
--   - SQL injection via search_path manipulasjon
--   - Ikke-deterministisk oppførsel på tvers av miljøer
--   - Uforutsigbar objektoppløsning
-- 
-- Løsning: Legge til SET search_path = '' og bruke fullt kvalifiserte navn
-- ============================================================================

-- Drop eksisterende trigger og funksjon
DROP TRIGGER IF EXISTS trigger_course_completion_sequence ON public.program_assignments;
DROP FUNCTION IF EXISTS public.handle_course_completion() CASCADE;

-- Gjenskape funksjonen med SET search_path = '' og public. prefix
CREATE FUNCTION public.handle_course_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_theme_id UUID;
  v_completed_sort_order INTEGER;
  v_next_course RECORD;
BEGIN
  -- Kun kjør når status endres til 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Hent tema og sort_order for det fullførte kurset
    SELECT theme_id, sort_order
    INTO v_theme_id, v_completed_sort_order
    FROM public.training_programs
    WHERE id = NEW.program_id;

    -- Finn alle kurs i samme tema som kan være klare for opplåsing
    FOR v_next_course IN
      SELECT tp.id as program_id, tp.prerequisite_type, tp.prerequisite_course_ids, tp.sort_order
      FROM public.training_programs tp
      WHERE tp.theme_id = v_theme_id
        AND tp.prerequisite_type != 'none'
      ORDER BY tp.sort_order
    LOOP
      -- Sjekk om dette kurset avhenger av det nettopp fullførte kurset
      DECLARE
        v_is_dependent BOOLEAN := FALSE;
        v_assignment_id UUID;
        v_current_status VARCHAR;
      BEGIN
        -- Sjekk ulike typer avhengigheter
        IF v_next_course.prerequisite_type IN ('previous_auto', 'previous_manual') THEN
          -- Sjekk om det fullførte kurset er rett før dette kurset
          IF v_next_course.sort_order > v_completed_sort_order THEN
            -- Finn om det fullførte kurset er det forrige i sekvensen
            DECLARE
              v_previous_sort_order INTEGER;
            BEGIN
              SELECT MAX(sort_order) INTO v_previous_sort_order
              FROM public.training_programs
              WHERE theme_id = v_theme_id
                AND sort_order < v_next_course.sort_order;
              
              IF v_previous_sort_order = v_completed_sort_order THEN
                v_is_dependent := TRUE;
              END IF;
            END;
          END IF;
        ELSIF v_next_course.prerequisite_type = 'specific_courses' THEN
          -- Sjekk om det fullførte kurset er i listen over forutsetninger
          IF NEW.program_id = ANY(v_next_course.prerequisite_course_ids) THEN
            v_is_dependent := TRUE;
          END IF;
        END IF;

        -- Hvis avhengig, oppdater status
        IF v_is_dependent THEN
          -- Sjekk om brukeren har en assignment for dette kurset
          SELECT id, status INTO v_assignment_id, v_current_status
          FROM public.program_assignments
          WHERE program_id = v_next_course.program_id
            AND assigned_to_user_id = NEW.assigned_to_user_id
          LIMIT 1;

          IF v_assignment_id IS NOT NULL THEN
            -- Beregn ny status basert på forutsetninger
            DECLARE
              v_new_status VARCHAR;
            BEGIN
              -- Kaller calculate_course_status_from_prerequisites med public. prefix
              v_new_status := public.calculate_course_status_from_prerequisites(
                NEW.assigned_to_user_id,
                v_next_course.program_id,
                v_current_status
              );

              -- Oppdater kun hvis status faktisk endres
              IF v_new_status != v_current_status THEN
                UPDATE public.program_assignments
                SET status = v_new_status,
                    assigned_at = CASE 
                      WHEN v_new_status = 'assigned' THEN NOW()
                      ELSE assigned_at
                    END
                WHERE id = v_assignment_id;
              END IF;
            END;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Gjenskape trigger
CREATE TRIGGER trigger_course_completion_sequence
  AFTER UPDATE OF status ON public.program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_completion();

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

