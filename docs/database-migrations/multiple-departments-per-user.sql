-- Migrering: Flere avdelinger per bruker (mange-til-mange)
-- Dato: 2025-11-24
-- Formål: Tillate at en bruker kan være medlem av flere avdelinger samtidig

-- 1. Opprett user_departments mellomtabell
CREATE TABLE IF NOT EXISTS user_departments (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, department_id)
);

-- 2. Migrer eksisterende data fra profiles.department_id til user_departments
INSERT INTO user_departments (user_id, department_id)
SELECT id, department_id
FROM profiles
WHERE department_id IS NOT NULL;

-- 3. Opprett indekser for ytelse
CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department ON user_departments(department_id);

-- 4. Oppdater auto_assign_department_programs trigger for å håndtere flere avdelinger
-- Denne triggeren må nå sjekke user_departments i stedet for profiles.department_id
CREATE OR REPLACE FUNCTION auto_assign_department_programs()
RETURNS TRIGGER AS $$
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
      FROM program_assignments pa
      JOIN training_programs tp ON pa.program_id = tp.id
      WHERE pa.assigned_to_department_id = NEW.department_id
      AND pa.status = 'assigned'
    LOOP
      -- Sjekk om brukeren allerede har denne tildelingen
      IF NOT EXISTS (
        SELECT 1 FROM program_assignments 
        WHERE program_id = v_program_record.program_id 
        AND assigned_to_user_id = NEW.user_id
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
$$ LANGUAGE plpgsql;

-- 5. Slett gammel trigger på profiles og opprett ny på user_departments
DROP TRIGGER IF EXISTS trigger_auto_assign_department_programs ON profiles;

CREATE TRIGGER trigger_auto_assign_department_programs
  AFTER INSERT ON user_departments
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_department_programs();

-- 6. Oppdater assign_program_to_department for å bruke user_departments
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
  -- Bruker nå user_departments i stedet for profiles.department_id
  FOR v_user_record IN 
    SELECT user_id FROM user_departments WHERE department_id = p_department_id
  LOOP
    -- Sjekk om brukeren allerede har dette kurset
    SELECT id INTO v_existing_user_assignment
    FROM program_assignments
    WHERE program_id = p_program_id
      AND assigned_to_user_id = v_user_record.user_id
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
$$ LANGUAGE plpgsql;

-- 7. Opprett hjelpefunksjon for å hente brukerens avdelinger
CREATE OR REPLACE FUNCTION get_user_departments(p_user_id UUID)
RETURNS TABLE (
  department_id UUID,
  department_name VARCHAR,
  department_description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description
  FROM user_departments ud
  JOIN departments d ON ud.department_id = d.id
  WHERE ud.user_id = p_user_id
  ORDER BY d.name;
END;
$$ LANGUAGE plpgsql;

-- 8. Opprett hjelpefunksjon for å hente avdelingens brukere
CREATE OR REPLACE FUNCTION get_department_users(p_department_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name VARCHAR,
  email VARCHAR,
  role VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role
  FROM user_departments ud
  JOIN profiles p ON ud.user_id = p.id
  WHERE ud.department_id = p_department_id
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql;

-- 9. VALGFRITT: Slett department_id kolonnen fra profiles
-- KJØR KUN DENNE HVIS DU ER SIKKER PÅ AT ALT FUNGERER!
-- KOMMENTAR UT DISSE LINJENE TIL DU HAR TESTET:
/*
ALTER TABLE profiles DROP COLUMN IF EXISTS department_id;
*/

-- 10. Oppdater schema cache
NOTIFY pgrst, 'reload schema';

-- VIKTIG NOTIS:
-- Etter at du har kjørt denne migreringen:
-- 1. Verifiser at data i user_departments er riktig
-- 2. Test at auto-assignment fungerer
-- 3. Test at avdelingsadministrasjon fungerer
-- 4. Når alt er verifisert, kan du kjøre punkt 9 for å slette profiles.department_id

