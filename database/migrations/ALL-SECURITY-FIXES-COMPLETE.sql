-- ============================================================================
-- KOMPLETT SIKKERHETSFIKS - KJØR DETTE I SUPABASE SQL EDITOR
-- ============================================================================
-- Inneholder ALLE 12 sikkerhetsfixer i korrekt rekkefølge
-- Dato: 2024
-- ============================================================================

-- ============================================================================
-- DEL 1: AKTIVER RLS PÅ TABELLER
-- ============================================================================

-- 1a. Enable RLS on training_programs
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- 1b. Enable RLS on user_departments
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEL 2: FIX VIEW MED SECURITY INVOKER
-- ============================================================================

-- 2. user_assignments view - fjern SECURITY DEFINER
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
  tp.title as program_title,
  tp.description as program_description,
  tp.deadline_days,
  t.name as theme_name,
  CASE 
    WHEN pa.status IN ('completed', 'locked', 'pending') THEN 0
    WHEN pa.due_date < NOW() THEN 0
    ELSE EXTRACT(EPOCH FROM (pa.due_date - NOW())) / 86400 
  END::INTEGER as days_remaining,
  CASE 
    WHEN pa.status = 'locked' THEN 'locked'
    WHEN pa.status = 'pending' THEN 'pending'
    WHEN pa.status = 'completed' THEN 'completed'
    WHEN pa.due_date < NOW() AND pa.status != 'completed' THEN 'overdue'
    WHEN pa.status = 'started' THEN 'in_progress'
    ELSE 'not_started'
  END as calculated_status,
  COALESCE(
    (SELECT COUNT(*)::FLOAT FROM user_progress up 
     WHERE up.program_id = tp.id 
     AND up.user_id = pa.assigned_to_user_id 
     AND up.status = 'completed') / NULLIF(
       (SELECT COUNT(*) FROM modules WHERE program_id = tp.id), 0
     ) * 100, 0
  )::INTEGER as progress_percentage,
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
-- DEL 3: FIX FUNKSJONER MED SEARCH_PATH (i avhengighetsrekkefølge)
-- ============================================================================

-- 3a. check_course_prerequisites_met (grunnfunksjon)
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

-- 3b. calculate_course_status_from_prerequisites (avhenger av 3a)
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

-- 3c. handle_course_completion (avhenger av 3b, trigger)
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

-- 3d. get_next_course_in_program
DROP FUNCTION IF EXISTS public.get_next_course_in_program(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_course_in_program(UUID, UUID) CASCADE;

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

-- 3e. update_topics_updated_at
DROP TRIGGER IF EXISTS topics_updated_at ON public.topics;
DROP FUNCTION IF EXISTS public.update_topics_updated_at() CASCADE;

CREATE FUNCTION public.update_topics_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER topics_updated_at
    BEFORE UPDATE ON public.topics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_topics_updated_at();

-- 3f. update_invitation_updated_at
DROP FUNCTION IF EXISTS public.update_invitation_updated_at() CASCADE;

CREATE FUNCTION public.update_invitation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Gjenskape trigger hvis invitations-tabellen eksisterer
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS update_invitation_updated_at_trigger ON public.invitations;
        CREATE TRIGGER update_invitation_updated_at_trigger
            BEFORE UPDATE ON public.invitations
            FOR EACH ROW
            EXECUTE FUNCTION public.update_invitation_updated_at();
    END IF;
END $$;

-- 3g. create_invitation
DROP FUNCTION IF EXISTS public.create_invitation(uuid, character varying, character varying, character varying, uuid, uuid[]) CASCADE;

CREATE FUNCTION public.create_invitation(
  p_company_id uuid,
  p_email character varying,
  p_full_name character varying,
  p_role character varying,
  p_invited_by uuid,
  p_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation_id UUID;
  v_token VARCHAR;
  v_dept_id UUID;
BEGIN
  v_token := encode(gen_random_bytes(32), 'base64');
  
  INSERT INTO public.invitations (
    company_id,
    email,
    full_name,
    role,
    invited_by,
    token,
    expires_at
  ) VALUES (
    p_company_id,
    p_email,
    p_full_name,
    p_role,
    p_invited_by,
    v_token,
    NOW() + INTERVAL '30 days'
  ) RETURNING id INTO v_invitation_id;
  
  IF array_length(p_department_ids, 1) > 0 THEN
    FOREACH v_dept_id IN ARRAY p_department_ids
    LOOP
      INSERT INTO public.invitation_departments (invitation_id, department_id)
      VALUES (v_invitation_id, v_dept_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN v_invitation_id;
END;
$$;

-- 3h. update_physical_course_assignment_status
DROP FUNCTION IF EXISTS public.update_physical_course_assignment_status() CASCADE;

CREATE FUNCTION public.update_physical_course_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_assignment_id UUID;
  v_program_id UUID;
  v_course_type VARCHAR(50);
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_total_items INTEGER;
  v_completed_items INTEGER;
BEGIN
  v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  SELECT ci.program_id INTO v_program_id
  FROM public.course_items ci
  WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
  
  SELECT course_type INTO v_course_type
  FROM public.training_programs
  WHERE id = v_program_id;
  
  IF v_course_type != 'physical-course' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) = COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'in_progress') > 0
  INTO v_total_items, v_completed_items, v_all_completed, v_any_in_progress
  FROM public.course_item_status
  WHERE assignment_id = v_assignment_id;
  
  IF v_all_completed AND v_total_items > 0 THEN
    UPDATE public.program_assignments
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_assignment_id AND status != 'completed';
  ELSIF v_any_in_progress THEN
    UPDATE public.program_assignments
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_assignment_id AND status NOT IN ('in_progress', 'completed');
  ELSIF v_completed_items = 0 THEN
    UPDATE public.program_assignments
    SET status = 'assigned', completed_at = NULL, updated_at = NOW()
    WHERE id = v_assignment_id AND status = 'completed';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Gjenskape trigger hvis tabellen eksisterer
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_item_status' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS update_physical_course_status_trigger ON public.course_item_status;
    CREATE TRIGGER update_physical_course_status_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.course_item_status
      FOR EACH ROW
      EXECUTE FUNCTION public.update_physical_course_assignment_status();
  END IF;
END $$;

-- 3i. create_course_item_status_on_assignment
DROP FUNCTION IF EXISTS public.create_course_item_status_on_assignment() CASCADE;

CREATE FUNCTION public.create_course_item_status_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_course_type VARCHAR(50);
  v_items RECORD;
BEGIN
  -- Sjekk om dette er et fysisk kurs
  SELECT course_type INTO v_course_type
  FROM public.training_programs
  WHERE id = NEW.program_id;
  
  -- Kun håndter fysiske kurs
  IF v_course_type != 'physical-course' THEN
    RETURN NEW;
  END IF;
  
  -- Opprett item_status for alle items i kurset
  FOR v_items IN 
    SELECT id FROM public.course_items 
    WHERE program_id = NEW.program_id
    ORDER BY order_index
  LOOP
    INSERT INTO public.course_item_status (assignment_id, item_id, status)
    VALUES (NEW.id, v_items.id, 'not_started')
    ON CONFLICT (assignment_id, item_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Gjenskape trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'program_assignments' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS create_course_item_status_trigger ON public.program_assignments;
    CREATE TRIGGER create_course_item_status_trigger
      AFTER INSERT ON public.program_assignments
      FOR EACH ROW
      EXECUTE FUNCTION public.create_course_item_status_on_assignment();
  END IF;
END $$;

-- ============================================================================
-- FERDIG! Alle 12 sikkerhetsproblemer er nå fikset.
-- ============================================================================
-- Kjør Security Advisor i Supabase igjen for å verifisere.
-- 
-- HUSK: Aktiver også "Leaked Password Protection" i Dashboard:
--   Authentication → Settings → Security → Enable leaked password protection
-- ============================================================================

