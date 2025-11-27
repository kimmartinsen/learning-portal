-- ============================================================================
-- FIX: Automatisk sett status til locked/pending når assignments opprettes
-- ============================================================================
-- Dette sikrer at kurs med prerequisites automatisk får riktig status
-- når assignments opprettes, ikke bare når forrige kurs fullføres
-- ============================================================================

-- 1. FUNKSJON: Sett riktig status basert på prerequisites når assignment opprettes
CREATE OR REPLACE FUNCTION set_prerequisite_status_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_prerequisite_type VARCHAR;
  v_prerequisites_met BOOLEAN;
  v_new_status VARCHAR;
BEGIN
  -- Kun håndter nye assignments (ikke oppdateringer)
  IF TG_OP = 'INSERT' AND NEW.assigned_to_user_id IS NOT NULL THEN
    -- Hent prerequisite type for kurset
    SELECT prerequisite_type INTO v_prerequisite_type
    FROM training_programs
    WHERE id = NEW.program_id;

    -- Hvis ingen prerequisites, la status være som den er
    IF v_prerequisite_type = 'none' OR v_prerequisite_type IS NULL THEN
      RETURN NEW;
    END IF;

    -- Sjekk om prerequisites er oppfylt
    v_prerequisites_met := check_course_prerequisites_met(
      NEW.assigned_to_user_id,
      NEW.program_id
    );

    -- Bestem riktig status basert på prerequisites
    IF NOT v_prerequisites_met THEN
      -- Prerequisites ikke oppfylt, sett til locked
      NEW.status := 'locked';
    ELSIF v_prerequisite_type = 'previous_manual' THEN
      -- Prerequisites oppfylt, men krever manuell godkjenning
      NEW.status := 'pending';
    ELSE
      -- Prerequisites oppfylt og auto-unlock, sett til assigned
      NEW.status := 'assigned';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER: Kjør når assignment opprettes
DROP TRIGGER IF EXISTS trigger_set_prerequisite_status_on_assignment ON program_assignments;
CREATE TRIGGER trigger_set_prerequisite_status_on_assignment
  BEFORE INSERT ON program_assignments
  FOR EACH ROW
  WHEN (NEW.assigned_to_user_id IS NOT NULL)
  EXECUTE FUNCTION set_prerequisite_status_on_assignment();

-- 3. OPPDATER EKSISTERENDE ASSIGNMENTS
-- Sett alle eksisterende assignments til riktig status basert på prerequisites
DO $$
DECLARE
  v_assignment RECORD;
  v_prerequisite_type VARCHAR;
  v_prerequisites_met BOOLEAN;
  v_new_status VARCHAR;
BEGIN
  FOR v_assignment IN
    SELECT pa.id, pa.program_id, pa.assigned_to_user_id, pa.status
    FROM program_assignments pa
    JOIN training_programs tp ON pa.program_id = tp.id
    WHERE pa.assigned_to_user_id IS NOT NULL
      AND pa.status NOT IN ('completed', 'cancelled')
      AND tp.prerequisite_type != 'none'
      AND tp.prerequisite_type IS NOT NULL
  LOOP
    -- Hent prerequisite type
    SELECT prerequisite_type INTO v_prerequisite_type
    FROM training_programs
    WHERE id = v_assignment.program_id;

    -- Sjekk om prerequisites er oppfylt
    v_prerequisites_met := check_course_prerequisites_met(
      v_assignment.assigned_to_user_id,
      v_assignment.program_id
    );

    -- Bestem riktig status
    IF NOT v_prerequisites_met THEN
      v_new_status := 'locked';
    ELSIF v_prerequisite_type = 'previous_manual' THEN
      -- Hvis prerequisites er oppfylt og det krever manuell godkjenning
      -- Sjekk om det allerede er pending eller assigned
      IF v_assignment.status = 'locked' THEN
        v_new_status := 'pending';
      ELSE
        v_new_status := v_assignment.status; -- Behold eksisterende hvis allerede pending/assigned
      END IF;
    ELSE
      -- Auto-unlock, sett til assigned hvis prerequisites er oppfylt
      IF v_assignment.status = 'locked' THEN
        v_new_status := 'assigned';
      ELSE
        v_new_status := v_assignment.status; -- Behold eksisterende
      END IF;
    END IF;

    -- Oppdater kun hvis status endres
    IF v_new_status != v_assignment.status THEN
      UPDATE program_assignments
      SET status = v_new_status
      WHERE id = v_assignment.id;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå vil:
-- 1. Nye assignments automatisk få riktig status (locked/pending/assigned) basert på prerequisites
-- 2. Eksisterende assignments bli oppdatert til riktig status
-- 3. Kurs med prerequisites som ikke er oppfylt vil være 'locked'
-- 4. Kurs med 'previous_manual' som har oppfylt prerequisites vil være 'pending' (venter på godkjenning)
-- ============================================================================

