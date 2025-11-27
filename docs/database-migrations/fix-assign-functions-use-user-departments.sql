-- Migrering: Oppdater assign_program_to_department til å bruke user_departments
-- Dato: 2025-11-27
-- Formål: Fikse problem der assign_program_to_department fortsatt bruker profiles.department_id
--         i stedet for user_departments tabellen (mange-til-mange relasjon)

-- PROBLEM:
-- assign_program_to_department funksjonen bruker fortsatt:
--   SELECT id FROM profiles WHERE department_id = p_department_id
--
-- Men systemet bruker nå user_departments tabell for mange-til-mange relasjon.
-- Dette gjør at RPC-kallet feiler fordi ingen brukere blir funnet.

-- LØSNING:
-- Oppdater funksjonen til å bruke user_departments tabellen

-- 1. Oppdater assign_program_to_department funksjonen
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
    notes,
    status
  ) VALUES (
    p_program_id,
    p_department_id,
    p_assigned_by,
    v_due_date,
    p_notes,
    'assigned'
  ) RETURNING id INTO v_assignment_id;

  -- Opprett individuelle tildelinger for alle brukere i avdelingen
  -- FIKSET: Bruker nå user_departments i stedet for profiles.department_id
  FOR v_user_record IN
    SELECT user_id FROM user_departments WHERE department_id = p_department_id
  LOOP
    -- Sjekk om brukeren allerede har dette kurset (unngå duplikater)
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
        is_auto_assigned,
        status
      ) VALUES (
        p_program_id,
        v_user_record.user_id,
        p_assigned_by,
        v_due_date,
        p_notes,
        true,
        'assigned'
      );
    END IF;
  END LOOP;

  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Verifiser at auto_assign_department_programs trigger også bruker user_departments
-- (Dette skal allerede være fikset i multiple-departments-per-user.sql, men vi sjekker igjen)
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
          is_auto_assigned,
          status
        ) VALUES (
          v_program_record.program_id,
          NEW.user_id,
          v_program_record.assigned_by,
          v_due_date,
          v_program_record.notes,
          true,
          'assigned'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Slett gammel trigger på profiles hvis den finnes og opprett ny på user_departments
DROP TRIGGER IF EXISTS trigger_auto_assign_department_programs ON profiles;
DROP TRIGGER IF EXISTS trigger_auto_assign_department_programs ON user_departments;

CREATE TRIGGER trigger_auto_assign_department_programs
  AFTER INSERT ON user_departments
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_department_programs();

-- 4. Oppdater schema cache
NOTIFY pgrst, 'reload schema';

-- VIKTIG NOTIS:
-- Etter at du har kjørt denne migreringen:
-- 1. Test å tildele et kurs til en avdeling
-- 2. Verifiser at alle brukere i avdelingen får tildelingen
-- 3. Sjekk at notifikasjoner sendes korrekt
-- 4. Test at auto-assignment fungerer når en ny bruker legges til i en avdeling

-- For å kjøre denne filen i Supabase:
-- 1. Gå til Supabase Dashboard -> SQL Editor
-- 2. Kopier og lim inn innholdet av denne filen
-- 3. Kjør SQL-en
-- 4. Verifiser at funksjonen er oppdatert ved å teste kurstildeling
