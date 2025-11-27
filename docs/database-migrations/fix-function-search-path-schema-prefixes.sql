-- ============================================================================
-- FIX: Add schema prefixes to all table references in functions with SET search_path = ''
-- ============================================================================
-- Når search_path er tom, må alle tabellreferanser ha schema-prefix (public.)
-- Dette skriptet oppdaterer alle funksjoner til å bruke public. prefix
-- ============================================================================

-- Oppdater set_prerequisite_status_on_assignment
CREATE OR REPLACE FUNCTION set_prerequisite_status_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prerequisite_type VARCHAR(50);
  v_prerequisite_course_ids UUID[];
  v_has_uncompleted_prerequisites BOOLEAN := false;
  v_has_pending_approval BOOLEAN := false;
BEGIN
  -- Hent prerequisite-innstillinger fra kurset
  SELECT prerequisite_type, prerequisite_course_ids
  INTO v_prerequisite_type, v_prerequisite_course_ids
  FROM public.training_programs
  WHERE id = NEW.program_id;

  -- Hvis kurset har prerequisites
  IF v_prerequisite_type IS NOT NULL AND v_prerequisite_type != 'none' THEN
    IF v_prerequisite_type = 'sequential' THEN
      -- Sjekk om forrige kurs i sekvensen er fullført
      SELECT EXISTS (
        SELECT 1 FROM public.program_assignments pa
        JOIN public.training_programs tp ON pa.program_id = tp.id
        WHERE tp.theme_id = (SELECT theme_id FROM public.training_programs WHERE id = NEW.program_id)
          AND tp.sort_order < (SELECT sort_order FROM public.training_programs WHERE id = NEW.program_id)
          AND pa.assigned_to_user_id = NEW.assigned_to_user_id
          AND pa.status != 'completed'
        ORDER BY tp.sort_order DESC
        LIMIT 1
      ) INTO v_has_uncompleted_prerequisites;

      IF v_has_uncompleted_prerequisites THEN
        NEW.status := 'locked';
      ELSE
        NEW.status := 'assigned';
      END IF;
    ELSIF v_prerequisite_type = 'approval_required' THEN
      -- Krever godkjenning fra admin
      NEW.status := 'pending';
    ELSE
      -- Prerequisites oppfylt og auto-unlock, sett til assigned
      NEW.status := 'assigned';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater handle_course_completion
CREATE OR REPLACE FUNCTION handle_course_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_program_id UUID;
  v_user_id UUID;
  v_assignment_id UUID;
  v_current_status VARCHAR(50);
  v_new_status VARCHAR(50);
  v_prerequisite_type VARCHAR(50);
  v_next_course_id UUID;
  v_next_assignment_id UUID;
BEGIN
  -- Kun håndter når status endres til 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_program_id := NEW.program_id;
    v_user_id := NEW.assigned_to_user_id;
    v_assignment_id := NEW.id;
    v_current_status := NEW.status;

    -- Hent prerequisite type for dette kurset
    SELECT prerequisite_type INTO v_prerequisite_type
    FROM public.training_programs
    WHERE id = v_program_id;

    -- Hvis kurset har sequential prerequisites, lås opp neste kurs
    IF v_prerequisite_type = 'sequential' THEN
      -- Finn neste kurs i sekvensen
      SELECT tp.id INTO v_next_course_id
      FROM public.training_programs tp
      WHERE tp.theme_id = (SELECT theme_id FROM public.training_programs WHERE id = v_program_id)
        AND tp.sort_order = (SELECT sort_order FROM public.training_programs WHERE id = v_program_id) + 1
      LIMIT 1;

      IF v_next_course_id IS NOT NULL THEN
        -- Finn assignment for neste kurs
        SELECT id INTO v_next_assignment_id
        FROM public.program_assignments
        WHERE program_id = v_next_course_id
          AND assigned_to_user_id = v_user_id
        LIMIT 1;

        IF v_next_assignment_id IS NOT NULL THEN
          -- Oppdater status basert på prerequisites
          SELECT set_prerequisite_status_on_assignment() INTO v_new_status
          FROM public.program_assignments
          WHERE id = v_next_assignment_id;

          -- Hvis status er endret, oppdater assignment
          IF v_new_status != v_current_status THEN
            UPDATE public.program_assignments
            SET status = v_new_status,
                assigned_at = CASE 
                  WHEN v_new_status = 'assigned' THEN NOW()
                  ELSE assigned_at
                END
            WHERE id = v_next_assignment_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater auto_complete_instructor_assignments
CREATE OR REPLACE FUNCTION auto_complete_instructor_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_module_record RECORD;
  v_assignment_id UUID;
BEGIN
  -- Når instructor_id settes eller endres på et kurs
  IF NEW.instructor_id IS NOT NULL THEN
    -- Oppdater alle eksisterende assignments for instruktøren på dette kurset
    FOR v_assignment_id IN
      SELECT id FROM public.program_assignments
      WHERE program_id = NEW.id
        AND assigned_to_user_id = NEW.instructor_id
        AND status != 'completed'
    LOOP
      -- Oppdater assignment status
      UPDATE public.program_assignments
      SET 
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW())
      WHERE id = v_assignment_id;

      -- Marker alle moduler som fullført i user_progress
      FOR v_module_record IN
        SELECT id FROM public.modules WHERE program_id = NEW.id
      LOOP
        INSERT INTO public.user_progress (
          user_id,
          program_id,
          module_id,
          assignment_id,
          status,
          completed_at,
          started_at
        )
        VALUES (
          NEW.instructor_id,
          NEW.id,
          v_module_record.id,
          v_assignment_id,
          'completed',
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, program_id, module_id) 
        DO UPDATE SET
          status = 'completed',
          completed_at = NOW(),
          started_at = COALESCE(public.user_progress.started_at, NOW());
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater auto_complete_new_instructor_assignment
CREATE OR REPLACE FUNCTION auto_complete_new_instructor_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_module_record RECORD;
BEGIN
  -- Når en ny assignment opprettes for en instruktør
  IF NEW.assigned_to_user_id IS NOT NULL THEN
    -- Sjekk om brukeren er instruktør for dette kurset
    IF EXISTS (
      SELECT 1 FROM public.training_programs
      WHERE id = NEW.program_id
        AND instructor_id = NEW.assigned_to_user_id
    ) THEN
      -- Oppdater assignment status til completed
      NEW.status := 'completed';
      NEW.completed_at := COALESCE(NEW.completed_at, NOW());

      -- Marker alle moduler som fullført
      FOR v_module_record IN
        SELECT id FROM public.modules WHERE program_id = NEW.program_id
      LOOP
        INSERT INTO public.user_progress (
          user_id,
          program_id,
          module_id,
          assignment_id,
          status,
          completed_at,
          started_at
        )
        VALUES (
          NEW.assigned_to_user_id,
          NEW.program_id,
          v_module_record.id,
          NEW.id,
          'completed',
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, program_id, module_id) 
        DO UPDATE SET
          status = 'completed',
          completed_at = NOW(),
          started_at = COALESCE(public.user_progress.started_at, NOW());
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater prevent_instructor_progress_changes
CREATE OR REPLACE FUNCTION prevent_instructor_progress_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Hvis brukeren er instruktør for dette kurset, revert til completed
  IF EXISTS (
    SELECT 1 FROM public.training_programs
    WHERE id = NEW.program_id
      AND instructor_id = NEW.user_id
  ) THEN
    NEW.status := 'completed';
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater auto_complete_instructor_modules
CREATE OR REPLACE FUNCTION auto_complete_instructor_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Når en instruktør får en ny assignment, marker alle moduler som fullført
  IF EXISTS (
    SELECT 1 FROM public.training_programs
    WHERE id = NEW.program_id
      AND instructor_id = NEW.user_id
  ) THEN
    NEW.status := 'completed';
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater assign_program_to_user
CREATE OR REPLACE FUNCTION assign_program_to_user(
  p_program_id UUID,
  p_user_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
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

-- Oppdater assign_program_to_department
CREATE OR REPLACE FUNCTION assign_program_to_department(
  p_program_id UUID,
  p_department_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
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

-- Oppdater auto_assign_department_programs
CREATE OR REPLACE FUNCTION auto_assign_department_programs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_program_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- Når en ny bruker-avdeling-relasjon opprettes
  IF TG_OP = 'INSERT' THEN
    -- Finn alle aktive avdelingstildelinger for den nye avdelingen
    FOR v_program_record IN 
      SELECT DISTINCT pa.program_id, pa.assigned_by, pa.notes, tp.deadline_days
      FROM public.program_assignments pa
      JOIN public.training_programs tp ON pa.program_id = tp.id
      WHERE pa.assigned_to_department_id = NEW.department_id
      AND pa.status = 'assigned'
    LOOP
      -- Sjekk om brukeren allerede har denne tildelingen
      IF NOT EXISTS (
        SELECT 1 FROM public.program_assignments 
        WHERE program_id = v_program_record.program_id 
        AND assigned_to_user_id = NEW.user_id
      ) THEN
        -- Opprett individuell tildeling
        v_due_date := NOW() + (COALESCE(v_program_record.deadline_days, 14) || ' days')::INTERVAL;
        
        INSERT INTO public.program_assignments (
          program_id, 
          assigned_to_user_id, 
          assigned_by, 
          due_date, 
          notes,
          is_auto_assigned
        ) VALUES (
          v_program_record.program_id, 
          NEW.user_id, 
          v_program_record.assigned_by, 
          v_due_date, 
          v_program_record.notes,
          true
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Oppdater get_user_departments
CREATE OR REPLACE FUNCTION get_user_departments(p_user_id UUID)
RETURNS TABLE (
  department_id UUID,
  department_name VARCHAR,
  department_description TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description
  FROM public.user_departments ud
  JOIN public.departments d ON ud.department_id = d.id
  WHERE ud.user_id = p_user_id
  ORDER BY d.name;
END;
$$;

-- Oppdater get_department_users
CREATE OR REPLACE FUNCTION get_department_users(p_department_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role
  FROM public.user_departments ud
  JOIN public.profiles p ON ud.user_id = p.id
  WHERE ud.department_id = p_department_id
  ORDER BY p.full_name;
END;
$$;

-- Oppdater get_next_course_in_program
CREATE OR REPLACE FUNCTION get_next_course_in_program(
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

-- Oppdater update_assignment_status
CREATE OR REPLACE FUNCTION update_assignment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Når alle moduler er fullført, marker assignment som completed
  IF (
    SELECT COUNT(*) FROM public.modules WHERE program_id = NEW.program_id
  ) = (
    SELECT COUNT(*) FROM public.user_progress
    WHERE program_id = NEW.program_id
      AND user_id = NEW.user_id
      AND status = 'completed'
  ) THEN
    UPDATE public.program_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE program_id = NEW.program_id
      AND assigned_to_user_id = NEW.user_id
      AND status != 'completed';
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater check_course_prerequisites_met
CREATE OR REPLACE FUNCTION check_course_prerequisites_met(
  p_program_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_prerequisite_type VARCHAR(50);
  v_prerequisite_course_ids UUID[];
  v_all_completed BOOLEAN := true;
BEGIN
  -- Hent prerequisite-innstillinger
  SELECT prerequisite_type, prerequisite_course_ids
  INTO v_prerequisite_type, v_prerequisite_course_ids
  FROM public.training_programs
  WHERE id = p_program_id;

  -- Hvis ingen prerequisites, returner true
  IF v_prerequisite_type IS NULL OR v_prerequisite_type = 'none' THEN
    RETURN true;
  END IF;

  -- Sjekk basert på type
  IF v_prerequisite_type = 'sequential' THEN
    -- Sjekk om forrige kurs i sekvensen er fullført
    SELECT NOT EXISTS (
      SELECT 1 FROM public.program_assignments pa
      JOIN public.training_programs tp ON pa.program_id = tp.id
      WHERE tp.theme_id = (SELECT theme_id FROM public.training_programs WHERE id = p_program_id)
        AND tp.sort_order < (SELECT sort_order FROM public.training_programs WHERE id = p_program_id)
        AND pa.assigned_to_user_id = p_user_id
        AND pa.status != 'completed'
      ORDER BY tp.sort_order DESC
      LIMIT 1
    ) INTO v_all_completed;
  ELSIF v_prerequisite_type = 'specific_courses' AND v_prerequisite_course_ids IS NOT NULL THEN
    -- Sjekk om alle spesifikke kurs er fullført
    SELECT NOT EXISTS (
      SELECT 1 FROM unnest(v_prerequisite_course_ids) AS course_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.program_assignments
        WHERE program_id = course_id
          AND assigned_to_user_id = p_user_id
          AND status = 'completed'
      )
    ) INTO v_all_completed;
  END IF;

  RETURN v_all_completed;
END;
$$;

-- Oppdater calculate_course_status_from_prerequisites
CREATE OR REPLACE FUNCTION calculate_course_status_from_prerequisites(
  p_program_id UUID,
  p_user_id UUID
) RETURNS VARCHAR(50)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_prerequisite_type VARCHAR(50);
  v_prerequisites_met BOOLEAN;
BEGIN
  -- Hent prerequisite type
  SELECT prerequisite_type INTO v_prerequisite_type
  FROM public.training_programs
  WHERE id = p_program_id;

  -- Hvis ingen prerequisites, returner 'assigned'
  IF v_prerequisite_type IS NULL OR v_prerequisite_type = 'none' THEN
    RETURN 'assigned';
  END IF;

  -- Sjekk om prerequisites er oppfylt
  SELECT check_course_prerequisites_met(p_program_id, p_user_id) INTO v_prerequisites_met;

  -- Returner status basert på prerequisites
  IF v_prerequisite_type = 'approval_required' THEN
    RETURN 'pending';
  ELSIF NOT v_prerequisites_met THEN
    RETURN 'locked';
  ELSE
    RETURN 'assigned';
  END IF;
END;
$$;

-- Oppdater update_checklist_status_from_items
CREATE OR REPLACE FUNCTION update_checklist_status_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_all_completed BOOLEAN;
BEGIN
  -- Sjekk om alle items for denne checklisten er fullført
  SELECT NOT EXISTS (
    SELECT 1 FROM public.checklist_item_status
    WHERE checklist_id = NEW.checklist_id
      AND user_id = NEW.user_id
      AND status != 'completed'
  ) INTO v_all_completed;

  -- Oppdater checklist assignment status hvis alle items er fullført
  IF v_all_completed THEN
    UPDATE public.checklist_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE checklist_id = NEW.checklist_id
      AND assigned_to_user_id = NEW.user_id
      AND status != 'completed';
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater update_checklist_assignment_status
CREATE OR REPLACE FUNCTION update_checklist_assignment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Oppdater assignment status basert på item status
  IF (
    SELECT COUNT(*) FROM public.checklist_items WHERE checklist_id = NEW.checklist_id
  ) = (
    SELECT COUNT(*) FROM public.checklist_item_status
    WHERE checklist_id = NEW.checklist_id
      AND user_id = NEW.user_id
      AND status = 'completed'
  ) THEN
    UPDATE public.checklist_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE checklist_id = NEW.checklist_id
      AND assigned_to_user_id = NEW.user_id
      AND status != 'completed';
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater handle_checklist_department_assignment
CREATE OR REPLACE FUNCTION handle_checklist_department_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_assignment_id UUID;
  v_item_id UUID;
BEGIN
  -- Kun håndter nye department assignments
  IF NEW.assigned_to_department_id IS NOT NULL AND NEW.assigned_to_user_id IS NULL THEN
    -- Finn alle brukere i denne avdelingen
    FOR v_user_id IN 
      SELECT user_id FROM public.user_departments WHERE department_id = NEW.assigned_to_department_id
    LOOP
      -- Sjekk om brukeren allerede har en tildeling (fra annen avdeling eller direkte)
      SELECT id INTO v_assignment_id
      FROM public.checklist_assignments
      WHERE checklist_id = NEW.checklist_id
      AND assigned_to_user_id = v_user_id
      LIMIT 1;

      -- Hvis ikke, opprett auto-assigned tildeling
      IF v_assignment_id IS NULL THEN
        INSERT INTO public.checklist_assignments (
          checklist_id,
          assigned_to_user_id,
          assigned_by,
          is_auto_assigned
        ) VALUES (
          NEW.checklist_id,
          v_user_id,
          NEW.assigned_by,
          true
        ) RETURNING id INTO v_assignment_id;

        -- Opprett status for alle items
        FOR v_item_id IN
          SELECT id FROM public.checklist_items WHERE checklist_id = NEW.checklist_id
        LOOP
          INSERT INTO public.checklist_item_status (
            checklist_id,
            item_id,
            user_id,
            status
          ) VALUES (
            NEW.checklist_id,
            v_item_id,
            v_user_id,
            'not_started'
          )
          ON CONFLICT (checklist_id, item_id, user_id) DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Oppdater handle_checklist_department_removal
CREATE OR REPLACE FUNCTION handle_checklist_department_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_still_assigned BOOLEAN;
BEGIN
  -- Kun håndter når department assignment fjernes
  IF OLD.assigned_to_department_id IS NOT NULL THEN
    -- Finn alle brukere som var i denne avdelingen
    FOR v_user_id IN 
      SELECT user_id FROM public.user_departments WHERE department_id = OLD.assigned_to_department_id
    LOOP
      -- Sjekk om brukeren fortsatt er tildelt via en annen avdeling
      SELECT EXISTS (
        SELECT 1 FROM public.checklist_assignments ca
        JOIN public.user_departments ud ON ud.department_id = ca.assigned_to_department_id
        WHERE ca.checklist_id = OLD.checklist_id
          AND ca.assigned_to_department_id IS NOT NULL
          AND ca.assigned_to_department_id != OLD.assigned_to_department_id
          AND ud.user_id = v_user_id
      ) INTO v_still_assigned;

      -- Hvis brukeren ikke lenger er tildelt via noen avdeling, fjern auto-assigned tildeling
      IF NOT v_still_assigned THEN
        DELETE FROM public.checklist_assignments
        WHERE checklist_id = OLD.checklist_id
          AND assigned_to_user_id = v_user_id
          AND is_auto_assigned = true;
      END IF;
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

-- Oppdater create_default_notification_preferences
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Opprett standard notifikasjonspreferanser når en ny bruker opprettes
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FERDIG: Alle funksjoner har nå public. prefix på tabellreferanser
-- ============================================================================

