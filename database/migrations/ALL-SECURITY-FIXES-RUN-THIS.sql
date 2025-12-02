-- ============================================================================
-- SAMLET SIKKERHETSFIKS - KJØR DETTE I SUPABASE SQL EDITOR
-- ============================================================================
-- Inneholder alle 4 sikkerhetsfixer i korrekt rekkefølge:
--   1. user_assignments view (SECURITY INVOKER)
--   2. check_course_prerequisites_met (search_path)
--   3. calculate_course_status_from_prerequisites (search_path)
--   4. handle_course_completion (search_path + trigger)
-- ============================================================================

-- ============================================================================
-- 1. FIX: Remove SECURITY DEFINER from user_assignments view
-- ============================================================================

DROP VIEW IF EXISTS public.user_assignments CASCADE;

CREATE VIEW public.user_assignments
WITH (security_invoker = true) AS
SELECT 
  pa.id,
  pa.program_id,
  pa.assigned_to_user_id as user_id,
  pa.due_date,
  pa.status,
  pa.completed_at,
  pa.notes,
  pa.is_auto_assigned,
  pa.assigned_at,
  
  -- Program info
  tp.title as program_title,
  tp.description as program_description,
  tp.deadline_days,
  
  -- Theme info
  t.name as theme_name,
  
  -- Days remaining calculation
  CASE 
    WHEN pa.status IN ('completed', 'locked', 'pending') THEN 0
    WHEN pa.due_date < NOW() THEN 0
    ELSE EXTRACT(EPOCH FROM (pa.due_date - NOW())) / 86400 
  END::INTEGER as days_remaining,
  
  -- Calculated status - Respekter locked og pending
  CASE 
    WHEN pa.status = 'locked' THEN 'locked'
    WHEN pa.status = 'pending' THEN 'pending'
    WHEN pa.status = 'completed' THEN 'completed'
    WHEN pa.due_date < NOW() AND pa.status != 'completed' THEN 'overdue'
    WHEN pa.status = 'started' THEN 'in_progress'
    ELSE 'not_started'
  END as calculated_status,
  
  -- Progress from user_progress table
  COALESCE(
    (SELECT COUNT(*)::FLOAT FROM user_progress up 
     WHERE up.program_id = tp.id 
     AND up.user_id = pa.assigned_to_user_id 
     AND up.status = 'completed') / NULLIF(
       (SELECT COUNT(*) FROM modules WHERE program_id = tp.id), 0
     ) * 100, 0
  )::INTEGER as progress_percentage,
  
  -- Total modules and completed count
  (SELECT COUNT(*) FROM modules WHERE program_id = tp.id) as total_modules,
  (SELECT COUNT(*) FROM user_progress up 
   WHERE up.program_id = tp.id 
   AND up.user_id = pa.assigned_to_user_id 
   AND up.status = 'completed') as completed_modules
  
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
LEFT JOIN themes t ON tp.theme_id = t.id
WHERE pa.assigned_to_user_id IS NOT NULL;

GRANT SELECT ON public.user_assignments TO authenticated;

-- ============================================================================
-- 2. FIX: check_course_prerequisites_met - Mutable Search Path
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_course_prerequisites_met(UUID, UUID) CASCADE;

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
  SELECT prerequisite_type, prerequisite_course_ids, theme_id, sort_order
  INTO v_prerequisite_type, v_prerequisite_course_ids, v_theme_id, v_sort_order
  FROM public.training_programs
  WHERE id = p_program_id;

  IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
    RETURN TRUE;
  END IF;

  IF v_prerequisite_type IN ('previous_auto', 'previous_manual') THEN
    SELECT id INTO v_previous_program_id
    FROM public.training_programs
    WHERE theme_id = v_theme_id
      AND sort_order < v_sort_order
    ORDER BY sort_order DESC
    LIMIT 1;

    IF v_previous_program_id IS NULL THEN
      RETURN TRUE;
    END IF;

    SELECT EXISTS(
      SELECT 1
      FROM public.program_assignments
      WHERE program_id = v_previous_program_id
        AND assigned_to_user_id = p_user_id
        AND status = 'completed'
    ) INTO v_prerequisites_met;

    RETURN v_prerequisites_met;
  END IF;

  IF v_prerequisite_type = 'specific_courses' THEN
    IF v_prerequisite_course_ids IS NULL OR array_length(v_prerequisite_course_ids, 1) IS NULL THEN
      RETURN TRUE;
    END IF;

    SELECT COUNT(*) = array_length(v_prerequisite_course_ids, 1)
    INTO v_prerequisites_met
    FROM public.program_assignments
    WHERE program_id = ANY(v_prerequisite_course_ids)
      AND assigned_to_user_id = p_user_id
      AND status = 'completed';

    RETURN v_prerequisites_met;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================================
-- 3. FIX: calculate_course_status_from_prerequisites - Mutable Search Path
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_course_status_from_prerequisites(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_course_status_from_prerequisites(UUID, UUID, VARCHAR) CASCADE;

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
  SELECT prerequisite_type INTO v_prerequisite_type
  FROM public.training_programs
  WHERE id = p_program_id;

  IF p_current_status IN ('completed', 'in_progress', 'started') THEN
    RETURN p_current_status;
  END IF;

  IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
    RETURN 'assigned';
  END IF;

  v_prerequisites_met := public.check_course_prerequisites_met(p_user_id, p_program_id);

  IF NOT v_prerequisites_met THEN
    RETURN 'locked';
  END IF;

  IF v_prerequisite_type = 'previous_manual' THEN
    IF p_current_status = 'locked' THEN
      RETURN 'pending';
    ELSE
      RETURN p_current_status;
    END IF;
  ELSE
    RETURN 'assigned';
  END IF;
END;
$$;

-- ============================================================================
-- 4. FIX: handle_course_completion - Mutable Search Path + Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_course_completion_sequence ON public.program_assignments;
DROP FUNCTION IF EXISTS public.handle_course_completion() CASCADE;

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
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    SELECT theme_id, sort_order
    INTO v_theme_id, v_completed_sort_order
    FROM public.training_programs
    WHERE id = NEW.program_id;

    FOR v_next_course IN
      SELECT tp.id as program_id, tp.prerequisite_type, tp.prerequisite_course_ids, tp.sort_order
      FROM public.training_programs tp
      WHERE tp.theme_id = v_theme_id
        AND tp.prerequisite_type != 'none'
      ORDER BY tp.sort_order
    LOOP
      DECLARE
        v_is_dependent BOOLEAN := FALSE;
        v_assignment_id UUID;
        v_current_status VARCHAR;
      BEGIN
        IF v_next_course.prerequisite_type IN ('previous_auto', 'previous_manual') THEN
          IF v_next_course.sort_order > v_completed_sort_order THEN
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
          IF NEW.program_id = ANY(v_next_course.prerequisite_course_ids) THEN
            v_is_dependent := TRUE;
          END IF;
        END IF;

        IF v_is_dependent THEN
          SELECT id, status INTO v_assignment_id, v_current_status
          FROM public.program_assignments
          WHERE program_id = v_next_course.program_id
            AND assigned_to_user_id = NEW.assigned_to_user_id
          LIMIT 1;

          IF v_assignment_id IS NOT NULL THEN
            DECLARE
              v_new_status VARCHAR;
            BEGIN
              v_new_status := public.calculate_course_status_from_prerequisites(
                NEW.assigned_to_user_id,
                v_next_course.program_id,
                v_current_status
              );

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

CREATE TRIGGER trigger_course_completion_sequence
  AFTER UPDATE OF status ON public.program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_course_completion();

-- ============================================================================
-- FERDIG! Alle 4 sikkerhetsproblemer er nå fikset.
-- ============================================================================
-- Kjør Security Advisor i Supabase igjen for å verifisere.
-- ============================================================================

