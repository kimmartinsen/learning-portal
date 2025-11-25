-- ============================================================================
-- APPLY ALL MIGRATIONS: Fullkommen løsning for program-prerequisites
-- ============================================================================
-- Denne filen kjører alle nødvendige migrasjoner i riktig rekkefølge
-- Kjør denne filen i Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Legg til nye kolonner og constraints
-- ============================================================================

ALTER TABLE training_programs
ADD COLUMN IF NOT EXISTS prerequisite_type VARCHAR(50) DEFAULT 'none' 
  CHECK (prerequisite_type IN ('none', 'previous_auto', 'previous_manual', 'specific_courses'));

ALTER TABLE training_programs
ADD COLUMN IF NOT EXISTS prerequisite_course_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN training_programs.prerequisite_type IS 
  'Definerer hvordan dette kurset låses opp:
   - none: Alltid tilgjengelig
   - previous_auto: Låses opp automatisk når forrige kurs (sort_order - 1) fullføres
   - previous_manual: Låses opp etter admin godkjenning når forrige kurs fullføres
   - specific_courses: Låses opp når alle spesifiserte kurs i prerequisite_course_ids er fullført';

COMMENT ON COLUMN training_programs.prerequisite_course_ids IS 
  'Array av training_program IDs som må fullføres før dette kurset låses opp (kun brukt når prerequisite_type = specific_courses)';

-- Mark progression_type as deprecated
COMMENT ON COLUMN themes.progression_type IS 
  'DEPRECATED: Bruk heller prerequisite_type per kurs i training_programs. Beholdes for bakoverkompatibilitet.';

-- Sett alle eksisterende kurs til 'none' som standard
UPDATE training_programs
SET prerequisite_type = 'none'
WHERE prerequisite_type IS NULL;

-- ============================================================================
-- STEP 2: Opprett hjelpefunksjoner
-- ============================================================================

-- Funksjon: Sjekk om forutsetninger er oppfylt
CREATE OR REPLACE FUNCTION check_course_prerequisites_met(
  p_user_id UUID,
  p_program_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_prerequisite_type VARCHAR;
  v_prerequisite_course_ids UUID[];
  v_theme_id UUID;
  v_sort_order INTEGER;
  v_previous_program_id UUID;
  v_prerequisites_met BOOLEAN;
BEGIN
  -- Hent kurs-info
  SELECT prerequisite_type, prerequisite_course_ids, theme_id, sort_order
  INTO v_prerequisite_type, v_prerequisite_course_ids, v_theme_id, v_sort_order
  FROM training_programs
  WHERE id = p_program_id;

  -- Hvis ingen forutsetninger, returner true
  IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Hvis 'previous_auto' eller 'previous_manual', sjekk forrige kurs
  IF v_prerequisite_type IN ('previous_auto', 'previous_manual') THEN
    SELECT id INTO v_previous_program_id
    FROM training_programs
    WHERE theme_id = v_theme_id
      AND sort_order < v_sort_order
    ORDER BY sort_order DESC
    LIMIT 1;

    IF v_previous_program_id IS NULL THEN
      RETURN TRUE; -- Første kurs
    END IF;

    -- Sjekk om brukeren har fullført forrige kurs
    SELECT EXISTS(
      SELECT 1
      FROM program_assignments
      WHERE program_id = v_previous_program_id
        AND assigned_to_user_id = p_user_id
        AND status = 'completed'
    ) INTO v_prerequisites_met;

    RETURN v_prerequisites_met;
  END IF;

  -- Hvis 'specific_courses', sjekk om alle er fullført
  IF v_prerequisite_type = 'specific_courses' THEN
    IF v_prerequisite_course_ids IS NULL OR array_length(v_prerequisite_course_ids, 1) IS NULL THEN
      RETURN TRUE;
    END IF;

    SELECT COUNT(*) = array_length(v_prerequisite_course_ids, 1)
    INTO v_prerequisites_met
    FROM program_assignments
    WHERE program_id = ANY(v_prerequisite_course_ids)
      AND assigned_to_user_id = p_user_id
      AND status = 'completed';

    RETURN v_prerequisites_met;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funksjon: Beregn status basert på forutsetninger
CREATE OR REPLACE FUNCTION calculate_course_status_from_prerequisites(
  p_user_id UUID,
  p_program_id UUID,
  p_current_status VARCHAR DEFAULT 'assigned'
) RETURNS VARCHAR AS $$
DECLARE
  v_prerequisite_type VARCHAR;
  v_prerequisites_met BOOLEAN;
BEGIN
  SELECT prerequisite_type INTO v_prerequisite_type
  FROM training_programs
  WHERE id = p_program_id;

  -- Hvis kurset allerede er i gang/fullført, ikke endre
  IF p_current_status IN ('completed', 'in_progress', 'started') THEN
    RETURN p_current_status;
  END IF;

  IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
    RETURN 'assigned';
  END IF;

  v_prerequisites_met := check_course_prerequisites_met(p_user_id, p_program_id);

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Oppdater trigger for course completion
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_course_completion_sequence ON program_assignments;
DROP FUNCTION IF EXISTS handle_course_completion() CASCADE;

CREATE OR REPLACE FUNCTION handle_course_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_theme_id UUID;
  v_completed_sort_order INTEGER;
  v_next_course RECORD;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    SELECT theme_id, sort_order
    INTO v_theme_id, v_completed_sort_order
    FROM training_programs
    WHERE id = NEW.program_id;

    FOR v_next_course IN
      SELECT tp.id as program_id, tp.prerequisite_type, tp.prerequisite_course_ids, tp.sort_order
      FROM training_programs tp
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
              FROM training_programs
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
          FROM program_assignments
          WHERE program_id = v_next_course.program_id
            AND assigned_to_user_id = NEW.assigned_to_user_id
          LIMIT 1;

          IF v_assignment_id IS NOT NULL THEN
            DECLARE
              v_new_status VARCHAR;
            BEGIN
              v_new_status := calculate_course_status_from_prerequisites(
                NEW.assigned_to_user_id,
                v_next_course.program_id,
                v_current_status
              );

              IF v_new_status != v_current_status THEN
                UPDATE program_assignments
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_course_completion_sequence
  AFTER UPDATE OF status ON program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_course_completion();

-- ============================================================================
-- STEP 4: Oppdater user_assignments view
-- ============================================================================

CREATE OR REPLACE VIEW user_assignments AS
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

GRANT SELECT ON user_assignments TO authenticated;

-- ============================================================================
-- STEP 5: Opprett indekser for ytelse
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_training_programs_theme_sort 
  ON training_programs(theme_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_training_programs_prerequisites 
  ON training_programs USING GIN(prerequisite_course_ids);

-- ============================================================================
-- FERDIG! ✅ Migrasjonen er fullført!
-- ============================================================================
-- Nå har du:
-- 1. Fleksible prerequisites per kurs (none, previous_auto, previous_manual, specific_courses)
-- 2. Automatisk håndtering av locked/pending statuser via trigger
-- 3. Oppdatert user_assignments view som respekterer nye statuser
-- 4. Optimaliserte indekser for rask søking
-- 5. Hjelpefunksjoner for å sjekke forutsetninger
-- ============================================================================

