-- ============================================================================
-- AUTOMATISK FULLFØRING FOR INSTRUKTØRER
-- ============================================================================
-- Når en bruker settes som instruktør for et kurs, skal de automatisk
-- få status "Fullført" på det kurset (hvis de har en assignment)
-- ============================================================================

-- 1. FUNKSJON: Oppdater instruktør-assignments til completed når instructor_id settes
CREATE OR REPLACE FUNCTION auto_complete_instructor_assignments()
RETURNS TRIGGER AS $$
DECLARE
  v_module_record RECORD;
  v_assignment_id UUID;
BEGIN
  -- Når instructor_id settes eller endres på et kurs
  IF NEW.instructor_id IS NOT NULL THEN
    -- Oppdater alle eksisterende assignments for instruktøren på dette kurset
    FOR v_assignment_id IN
      SELECT id FROM program_assignments
      WHERE program_id = NEW.id
        AND assigned_to_user_id = NEW.instructor_id
        AND status != 'completed'
    LOOP
      -- Oppdater assignment status
      UPDATE program_assignments
      SET 
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW())
      WHERE id = v_assignment_id;

      -- Marker alle moduler som fullført i user_progress
      FOR v_module_record IN
        SELECT id FROM modules WHERE program_id = NEW.id
      LOOP
        INSERT INTO user_progress (
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
        ON CONFLICT (user_id, module_id)
        DO UPDATE SET
          assignment_id = COALESCE(user_progress.assignment_id, v_assignment_id),
          status = 'completed',
          completed_at = COALESCE(user_progress.completed_at, NOW()),
          started_at = COALESCE(user_progress.started_at, NOW());
      END LOOP;
    END LOOP;
  END IF;

  -- Hvis instructor_id fjernes, ikke gjør noe (beholder eksisterende status)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. FUNKSJON: Sett ny assignment til completed hvis brukeren er instruktør
CREATE OR REPLACE FUNCTION auto_complete_new_instructor_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_instructor_id UUID;
  v_module_record RECORD;
BEGIN
  -- Sjekk om brukeren er instruktør for dette kurset
  SELECT instructor_id INTO v_instructor_id
  FROM training_programs
  WHERE id = NEW.program_id;

  -- Hvis brukeren er instruktør, sett status til completed
  IF v_instructor_id = NEW.assigned_to_user_id THEN
    NEW.status := 'completed';
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2b. FUNKSJON: Marker alle moduler som fullført etter at assignment er opprettet
CREATE OR REPLACE FUNCTION auto_complete_instructor_modules()
RETURNS TRIGGER AS $$
DECLARE
  v_instructor_id UUID;
  v_module_record RECORD;
BEGIN
  -- Sjekk om brukeren er instruktør for dette kurset
  SELECT instructor_id INTO v_instructor_id
  FROM training_programs
  WHERE id = NEW.program_id;

  -- Hvis brukeren er instruktør og assignment er completed, marker alle moduler som fullført
  IF v_instructor_id = NEW.assigned_to_user_id AND NEW.status = 'completed' THEN
    FOR v_module_record IN
      SELECT id FROM modules WHERE program_id = NEW.program_id
    LOOP
      INSERT INTO user_progress (
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
        COALESCE(NEW.completed_at, NOW()),
        COALESCE(NEW.completed_at, NOW())
      )
      ON CONFLICT (user_id, module_id)
      DO UPDATE SET
        assignment_id = COALESCE(user_progress.assignment_id, NEW.id),
        status = 'completed',
        completed_at = COALESCE(user_progress.completed_at, NEW.completed_at, NOW()),
        started_at = COALESCE(user_progress.started_at, NEW.completed_at, NOW());
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGER: Kjør når instructor_id settes eller endres på kurs
DROP TRIGGER IF EXISTS trigger_auto_complete_instructor_assignments ON training_programs;
CREATE TRIGGER trigger_auto_complete_instructor_assignments
  AFTER INSERT OR UPDATE OF instructor_id ON training_programs
  FOR EACH ROW
  WHEN (NEW.instructor_id IS NOT NULL)
  EXECUTE FUNCTION auto_complete_instructor_assignments();

-- 4. TRIGGER: Kjør når ny assignment opprettes (BEFORE INSERT)
DROP TRIGGER IF EXISTS trigger_auto_complete_new_instructor_assignment ON program_assignments;
CREATE TRIGGER trigger_auto_complete_new_instructor_assignment
  BEFORE INSERT ON program_assignments
  FOR EACH ROW
  WHEN (NEW.assigned_to_user_id IS NOT NULL)
  EXECUTE FUNCTION auto_complete_new_instructor_assignment();

-- 5. TRIGGER: Kjør etter at assignment er opprettet (AFTER INSERT) for å markere moduler
DROP TRIGGER IF EXISTS trigger_auto_complete_instructor_modules ON program_assignments;
CREATE TRIGGER trigger_auto_complete_instructor_modules
  AFTER INSERT ON program_assignments
  FOR EACH ROW
  WHEN (NEW.assigned_to_user_id IS NOT NULL AND NEW.status = 'completed')
  EXECUTE FUNCTION auto_complete_instructor_modules();

-- 6. OPPDATER EKSISTERENDE INSTRUKTØR-ASSIGNMENTS
-- Sett alle eksisterende assignments til completed for instruktører
DO $$
DECLARE
  v_assignment_record RECORD;
  v_module_record RECORD;
BEGIN
  FOR v_assignment_record IN
    SELECT pa.id, pa.program_id, pa.assigned_to_user_id
    FROM program_assignments pa
    JOIN training_programs tp ON pa.program_id = tp.id
    WHERE tp.instructor_id = pa.assigned_to_user_id
      AND pa.status != 'completed'
  LOOP
    -- Oppdater assignment status
    UPDATE program_assignments
    SET 
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW())
    WHERE id = v_assignment_record.id;

    -- Marker alle moduler som fullført
    FOR v_module_record IN
      SELECT id FROM modules WHERE program_id = v_assignment_record.program_id
    LOOP
      INSERT INTO user_progress (
        user_id,
        program_id,
        module_id,
        assignment_id,
        status,
        completed_at,
        started_at
      )
      VALUES (
        v_assignment_record.assigned_to_user_id,
        v_assignment_record.program_id,
        v_module_record.id,
        v_assignment_record.id,
        'completed',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id, module_id)
      DO UPDATE SET
        assignment_id = COALESCE(user_progress.assignment_id, v_assignment_record.id),
        status = 'completed',
        completed_at = COALESCE(user_progress.completed_at, NOW()),
        started_at = COALESCE(user_progress.started_at, NOW());
    END LOOP;
  END LOOP;
END $$;

-- 7. TRIGGER: Forhindre at instruktører endrer status på user_progress
-- Hvis en instruktør prøver å endre status, sett den tilbake til completed
CREATE OR REPLACE FUNCTION prevent_instructor_progress_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_instructor_id UUID;
BEGIN
  -- Sjekk om brukeren er instruktør for dette kurset
  SELECT instructor_id INTO v_instructor_id
  FROM training_programs
  WHERE id = NEW.program_id;

  -- Hvis brukeren er instruktør, sett status til completed og behold completed_at
  IF v_instructor_id = NEW.user_id THEN
    NEW.status := 'completed';
    NEW.completed_at := COALESCE(NEW.completed_at, OLD.completed_at, NOW());
    NEW.started_at := COALESCE(NEW.started_at, OLD.started_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_instructor_progress_changes ON user_progress;
CREATE TRIGGER trigger_prevent_instructor_progress_changes
  BEFORE INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION prevent_instructor_progress_changes();

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå vil:
-- 1. Når en bruker settes som instruktør for et kurs, får de automatisk
--    status "Fullført" på det kurset (hvis de har en assignment)
-- 2. Eksisterende instruktør-assignments blir oppdatert til "completed"
-- 3. Alle moduler markeres som fullført i user_progress for instruktører
-- 4. Instruktører kan ikke endre status på user_progress (automatisk satt tilbake til completed)
-- ============================================================================

