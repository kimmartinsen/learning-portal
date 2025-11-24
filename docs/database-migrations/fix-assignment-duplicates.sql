-- Fikser duplikattildelinger av kurs
-- Dato: 2025-11-24
-- Problem: assign_program_to_department og assign_program_to_user sjekker ikke om brukeren allerede har kurset

-- 1. Oppdater assign_program_to_user for å sjekke eksisterende tildelinger
CREATE OR REPLACE FUNCTION assign_program_to_user(
  p_program_id UUID,
  p_user_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_assignment_id UUID;
  v_existing_assignment UUID;
BEGIN
  -- Sjekk om brukeren allerede har dette kurset (uansett om det er manuelt eller auto-tildelt)
  SELECT id INTO v_existing_assignment
  FROM program_assignments
  WHERE program_id = p_program_id
    AND assigned_to_user_id = p_user_id
  LIMIT 1;

  -- Hvis brukeren allerede har kurset, returner eksisterende assignment_id
  IF v_existing_assignment IS NOT NULL THEN
    RETURN v_existing_assignment;
  END IF;

  -- Hent deadline_days fra programmet
  SELECT deadline_days INTO v_deadline_days 
  FROM training_programs 
  WHERE id = p_program_id;
  
  -- Beregn due_date
  v_due_date := NOW() + (v_deadline_days || ' days')::INTERVAL;
  
  -- Opprett tildelingen
  INSERT INTO program_assignments (
    program_id, 
    assigned_to_user_id, 
    assigned_by, 
    due_date, 
    notes,
    is_auto_assigned
  ) VALUES (
    p_program_id, 
    p_user_id, 
    p_assigned_by, 
    v_due_date, 
    p_notes,
    false
  ) RETURNING id INTO v_assignment_id;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Oppdater assign_program_to_department for å unngå duplikater
CREATE OR REPLACE FUNCTION assign_program_to_department(
  p_program_id UUID,
  p_department_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_assignment_id UUID;
  v_user_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_existing_user_assignment UUID;
BEGIN
  -- Hent deadline_days fra programmet
  SELECT deadline_days INTO v_deadline_days 
  FROM training_programs 
  WHERE id = p_program_id;
  
  v_due_date := NOW() + (v_deadline_days || ' days')::INTERVAL;
  
  -- Opprett avdelingstildelingen
  INSERT INTO program_assignments (
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
  -- MEN kun hvis de ikke allerede har kurset
  FOR v_user_record IN 
    SELECT id FROM profiles WHERE department_id = p_department_id
  LOOP
    -- Sjekk om brukeren allerede har dette kurset
    SELECT id INTO v_existing_user_assignment
    FROM program_assignments
    WHERE program_id = p_program_id
      AND assigned_to_user_id = v_user_record.id
    LIMIT 1;

    -- Kun opprett ny tildeling hvis brukeren ikke allerede har kurset
    IF v_existing_user_assignment IS NULL THEN
      INSERT INTO program_assignments (
        program_id, 
        assigned_to_user_id, 
        assigned_by, 
        due_date, 
        notes,
        is_auto_assigned
      ) VALUES (
        p_program_id, 
        v_user_record.id, 
        p_assigned_by, 
        v_due_date, 
        p_notes,
        true
      );
    END IF;
  END LOOP;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Oppdater auto_assign_department_programs (triggeren holder allerede sjekk, men vi forbedrer den)
CREATE OR REPLACE FUNCTION auto_assign_department_programs()
RETURNS TRIGGER AS $$
DECLARE
  v_program_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- Kun når department_id endres (ikke ved opprettelse uten avdeling)
  IF NEW.department_id IS NOT NULL AND 
     (OLD.department_id IS NULL OR OLD.department_id != NEW.department_id) THEN
    
    -- Finn alle aktive avdelingstildelinger for den nye avdelingen
    FOR v_program_record IN 
      SELECT DISTINCT pa.program_id, pa.assigned_by, pa.notes, tp.deadline_days
      FROM program_assignments pa
      JOIN training_programs tp ON pa.program_id = tp.id
      WHERE pa.assigned_to_department_id = NEW.department_id
      AND pa.status = 'assigned'
    LOOP
      -- Sjekk om brukeren allerede har denne tildelingen
      IF NOT EXISTS (
        SELECT 1 FROM program_assignments 
        WHERE program_id = v_program_record.program_id 
        AND assigned_to_user_id = NEW.id
      ) THEN
        -- Opprett individuell tildeling
        v_due_date := NOW() + (v_program_record.deadline_days || ' days')::INTERVAL;
        
        INSERT INTO program_assignments (
          program_id, 
          assigned_to_user_id, 
          assigned_by, 
          due_date, 
          notes,
          is_auto_assigned
        ) VALUES (
          v_program_record.program_id, 
          NEW.id, 
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
$$ LANGUAGE plpgsql;

-- 4. Oppdater triggeren
DROP TRIGGER IF EXISTS trigger_auto_assign_department_programs ON profiles;
CREATE TRIGGER trigger_auto_assign_department_programs
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_department_programs();

-- 5. Fjern eksisterende duplikater (valgfritt - kjør kun hvis du har duplikater)
-- Dette beholder kun den ELDSTE tildelingen per bruker per program
/*
DELETE FROM program_assignments pa1
WHERE EXISTS (
  SELECT 1 FROM program_assignments pa2
  WHERE pa1.program_id = pa2.program_id
    AND pa1.assigned_to_user_id = pa2.assigned_to_user_id
    AND pa1.assigned_to_user_id IS NOT NULL
    AND pa1.created_at > pa2.created_at
);
*/

-- 6. Oppdater schema cache
NOTIFY pgrst, 'reload schema';

