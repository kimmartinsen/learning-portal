-- ============================================================================
-- AUTOMATISK FULLFØRING FOR INSTRUKTØRER
-- ============================================================================
-- Når en bruker settes som instruktør for et kurs, skal de automatisk
-- få status "Fullført" på det kurset (hvis de har en assignment)
-- ============================================================================

-- 1. FUNKSJON: Oppdater instruktør-assignments til completed når instructor_id settes
CREATE OR REPLACE FUNCTION auto_complete_instructor_assignments()
RETURNS TRIGGER AS $$
BEGIN
  -- Når instructor_id settes eller endres på et kurs
  IF NEW.instructor_id IS NOT NULL THEN
    -- Oppdater alle eksisterende assignments for instruktøren på dette kurset
    UPDATE program_assignments
    SET 
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW())
    WHERE program_id = NEW.id
      AND assigned_to_user_id = NEW.instructor_id
      AND status != 'completed';
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

-- 3. TRIGGER: Kjør når instructor_id settes eller endres på kurs
DROP TRIGGER IF EXISTS trigger_auto_complete_instructor_assignments ON training_programs;
CREATE TRIGGER trigger_auto_complete_instructor_assignments
  AFTER INSERT OR UPDATE OF instructor_id ON training_programs
  FOR EACH ROW
  WHEN (NEW.instructor_id IS NOT NULL)
  EXECUTE FUNCTION auto_complete_instructor_assignments();

-- 4. TRIGGER: Kjør når ny assignment opprettes
DROP TRIGGER IF EXISTS trigger_auto_complete_new_instructor_assignment ON program_assignments;
CREATE TRIGGER trigger_auto_complete_new_instructor_assignment
  BEFORE INSERT ON program_assignments
  FOR EACH ROW
  WHEN (NEW.assigned_to_user_id IS NOT NULL)
  EXECUTE FUNCTION auto_complete_new_instructor_assignment();

-- 3. OPPDATER EKSISTERENDE INSTRUKTØR-ASSIGNMENTS
-- Sett alle eksisterende assignments til completed for instruktører
UPDATE program_assignments pa
SET 
  status = 'completed',
  completed_at = COALESCE(pa.completed_at, NOW())
FROM training_programs tp
WHERE pa.program_id = tp.id
  AND tp.instructor_id = pa.assigned_to_user_id
  AND pa.status != 'completed';

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå vil:
-- 1. Når en bruker settes som instruktør for et kurs, får de automatisk
--    status "Fullført" på det kurset (hvis de har en assignment)
-- 2. Eksisterende instruktør-assignments blir oppdatert til "completed"
-- ============================================================================

