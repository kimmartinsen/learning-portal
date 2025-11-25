-- ============================================================================
-- MIGRATION: Program Prerequisites and Flexible Course Dependencies
-- ============================================================================
-- Dette lar oss definere fleksible avhengigheter mellom kurs i et program
-- Hvert kurs kan ha sin egen regel for når det skal låses opp
-- ============================================================================

-- 1. LEGG TIL KOLONNER FOR AVHENGIGHETER I TRAINING_PROGRAMS
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

-- 2. FJERN GAMMEL PROGRESSION_TYPE FRA THEMES (vi styrer nå per kurs)
-- Vi beholder kolonnen for bakoverkompatibilitet, men den brukes ikke lenger aktivt
COMMENT ON COLUMN themes.progression_type IS 
  'DEPRECATED: Bruk heller prerequisite_type per kurs i training_programs. Beholdes for bakoverkompatibilitet.';

-- 3. OPPRETT HJELPEFUNKSJON: Sjekk om et kurs har oppfylt alle forutsetninger
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

  -- Hvis 'previous_auto' eller 'previous_manual', sjekk forrige kurs i samme tema
  IF v_prerequisite_type IN ('previous_auto', 'previous_manual') THEN
    -- Finn forrige kurs i sekvensen
    SELECT id INTO v_previous_program_id
    FROM training_programs
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
      FROM program_assignments
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
    FROM program_assignments
    WHERE program_id = ANY(v_prerequisite_course_ids)
      AND assigned_to_user_id = p_user_id
      AND status = 'completed';

    RETURN v_prerequisites_met;
  END IF;

  -- Default: returner false hvis ukjent type
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. OPPRETT HJELPEFUNKSJON: Bestem status for et kurs basert på forutsetninger
CREATE OR REPLACE FUNCTION calculate_course_status_from_prerequisites(
  p_user_id UUID,
  p_program_id UUID,
  p_current_status VARCHAR DEFAULT 'assigned'
) RETURNS VARCHAR AS $$
DECLARE
  v_prerequisite_type VARCHAR;
  v_prerequisites_met BOOLEAN;
BEGIN
  -- Hent prerequisite type
  SELECT prerequisite_type INTO v_prerequisite_type
  FROM training_programs
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
  v_prerequisites_met := check_course_prerequisites_met(p_user_id, p_program_id);

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. OPPDATER TRIGGER FOR COURSE COMPLETION
-- Når et kurs fullføres, sjekk hvilke andre kurs som kan låses opp
DROP TRIGGER IF EXISTS trigger_course_completion_sequence ON program_assignments;
DROP FUNCTION IF EXISTS handle_course_completion() CASCADE;

CREATE OR REPLACE FUNCTION handle_course_completion()
RETURNS TRIGGER AS $$
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
    FROM training_programs
    WHERE id = NEW.program_id;

    -- Finn alle kurs i samme tema som kan være klare for opplåsing
    FOR v_next_course IN
      SELECT tp.id as program_id, tp.prerequisite_type, tp.prerequisite_course_ids, tp.sort_order
      FROM training_programs tp
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
              FROM training_programs
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
          FROM program_assignments
          WHERE program_id = v_next_course.program_id
            AND assigned_to_user_id = NEW.assigned_to_user_id
          LIMIT 1;

          IF v_assignment_id IS NOT NULL THEN
            -- Beregn ny status basert på forutsetninger
            DECLARE
              v_new_status VARCHAR;
            BEGIN
              v_new_status := calculate_course_status_from_prerequisites(
                NEW.assigned_to_user_id,
                v_next_course.program_id,
                v_current_status
              );

              -- Oppdater kun hvis status faktisk endres
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

-- 6. OPPDATER EKSISTERENDE KURS MED DEFAULT VERDIER
-- Sett alle eksisterende kurs til 'none' (alltid tilgjengelig) som standard
UPDATE training_programs
SET prerequisite_type = 'none'
WHERE prerequisite_type IS NULL;

-- 7. INDEKSER FOR YTELSE
CREATE INDEX IF NOT EXISTS idx_training_programs_theme_sort 
  ON training_programs(theme_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_training_programs_prerequisites 
  ON training_programs USING GIN(prerequisite_course_ids);

-- ============================================================================
-- FERDIG: Nå kan hvert kurs ha sin egen regel for når det skal låses opp
-- ============================================================================

