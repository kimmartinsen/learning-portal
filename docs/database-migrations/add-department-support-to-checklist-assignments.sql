-- ============================================================================
-- LEGG TIL STØTTE FOR AVDELINGSTILDELINGER I CHECKLIST_ASSIGNMENTS
-- ============================================================================
-- Dette løser problemet hvor brukere i flere avdelinger automatisk
-- får alle avdelinger tildelt når man prøver å gjenopprette tildelinger
-- ============================================================================

-- 1. Gjør assigned_to_user_id nullable (som i program_assignments)
ALTER TABLE checklist_assignments
ALTER COLUMN assigned_to_user_id DROP NOT NULL;

-- 2. Legg til assigned_to_department_id kolonne
ALTER TABLE checklist_assignments
ADD COLUMN IF NOT EXISTS assigned_to_department_id UUID REFERENCES departments(id) ON DELETE CASCADE;

-- 3. Legg til is_auto_assigned flagg (for å skille mellom direkte og auto-assigned)
ALTER TABLE checklist_assignments
ADD COLUMN IF NOT EXISTS is_auto_assigned BOOLEAN DEFAULT false;

-- 4. Oppdater UNIQUE constraint til å tillate enten user_id ELLER department_id
ALTER TABLE checklist_assignments
DROP CONSTRAINT IF EXISTS checklist_assignments_checklist_id_assigned_to_user_id_key;

-- Legg til check constraint for å sikre at enten user_id eller department_id er satt
ALTER TABLE checklist_assignments
DROP CONSTRAINT IF EXISTS checklist_assignments_user_or_department_check;

ALTER TABLE checklist_assignments
ADD CONSTRAINT checklist_assignments_user_or_department_check 
CHECK (
  (assigned_to_user_id IS NOT NULL AND assigned_to_department_id IS NULL) OR
  (assigned_to_user_id IS NULL AND assigned_to_department_id IS NOT NULL)
);

-- Legg til UNIQUE constraint for department assignments
ALTER TABLE checklist_assignments
DROP CONSTRAINT IF EXISTS checklist_assignments_checklist_department_unique;

ALTER TABLE checklist_assignments
ADD CONSTRAINT checklist_assignments_checklist_department_unique 
UNIQUE(checklist_id, assigned_to_department_id);

-- 4. Legg til indeks for department_id
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_department 
ON checklist_assignments(assigned_to_department_id);

-- 5. Oppdater RLS policies for å inkludere department assignments
DROP POLICY IF EXISTS "Users view their own checklist assignments" ON checklist_assignments;

CREATE POLICY "Users view their own checklist assignments" ON checklist_assignments FOR SELECT 
  USING (
    assigned_to_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_departments ud
      WHERE ud.user_id = auth.uid()
      AND ud.department_id = checklist_assignments.assigned_to_department_id
    ) OR
    EXISTS (
      SELECT 1 FROM checklists c
      WHERE c.id = checklist_assignments.checklist_id
      AND c.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- 6. Trigger for å auto-assigne til brukere når en avdeling tildeles
CREATE OR REPLACE FUNCTION handle_checklist_department_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_assignment_id UUID;
  v_item_id UUID;
BEGIN
  -- Kun håndter nye department assignments
  IF NEW.assigned_to_department_id IS NOT NULL AND NEW.assigned_to_user_id IS NULL THEN
    -- Finn alle brukere i denne avdelingen
    FOR v_user_id IN 
      SELECT user_id FROM user_departments WHERE department_id = NEW.assigned_to_department_id
    LOOP
      -- Sjekk om brukeren allerede har en tildeling (fra annen avdeling eller direkte)
      SELECT id INTO v_assignment_id
      FROM checklist_assignments
      WHERE checklist_id = NEW.checklist_id
      AND assigned_to_user_id = v_user_id
      LIMIT 1;

      -- Hvis ikke, opprett auto-assigned tildeling
      IF v_assignment_id IS NULL THEN
        INSERT INTO checklist_assignments (
          checklist_id,
          assigned_to_user_id,
          assigned_by,
          is_auto_assigned
        )
        VALUES (
          NEW.checklist_id,
          v_user_id,
          NEW.assigned_by,
          true
        )
        RETURNING id INTO v_assignment_id;

        -- Opprett item statuses for denne brukeren
        FOR v_item_id IN 
          SELECT id FROM checklist_items WHERE checklist_id = NEW.checklist_id
        LOOP
          INSERT INTO checklist_item_status (
            assignment_id,
            item_id,
            status
          )
          VALUES (
            v_assignment_id,
            v_item_id,
            'not_started'
          )
          ON CONFLICT (assignment_id, item_id) DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_checklist_department_assignment ON checklist_assignments;

CREATE TRIGGER trigger_handle_checklist_department_assignment
  AFTER INSERT ON checklist_assignments
  FOR EACH ROW
  WHEN (NEW.assigned_to_department_id IS NOT NULL)
  EXECUTE FUNCTION handle_checklist_department_assignment();

-- 7. Trigger for å fjerne auto-assigned tildelinger når department assignment fjernes
CREATE OR REPLACE FUNCTION handle_checklist_department_removal()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Kun håndter når department assignment fjernes
  IF OLD.assigned_to_department_id IS NOT NULL THEN
    -- Finn alle brukere i denne avdelingen
    FOR v_user_id IN 
      SELECT user_id FROM user_departments WHERE department_id = OLD.assigned_to_department_id
    LOOP
      -- Slett auto-assigned tildelinger for disse brukerne
      -- (men ikke hvis de har direkte tildelinger fra andre avdelinger)
      DELETE FROM checklist_assignments
      WHERE checklist_id = OLD.checklist_id
      AND assigned_to_user_id = v_user_id
      AND is_auto_assigned = true
      AND NOT EXISTS (
        -- Ikke slett hvis brukeren har direkte tildeling eller er i annen tildelt avdeling
        SELECT 1 FROM checklist_assignments ca
        WHERE ca.checklist_id = OLD.checklist_id
        AND ca.assigned_to_user_id = v_user_id
        AND ca.id != checklist_assignments.id
        AND (
          ca.is_auto_assigned = false OR
          EXISTS (
            SELECT 1 FROM user_departments ud
            JOIN checklist_assignments ca2 ON ca2.assigned_to_department_id = ud.department_id
            WHERE ud.user_id = v_user_id
            AND ca2.checklist_id = OLD.checklist_id
            AND ca2.id != OLD.id
          )
        )
      );
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_checklist_department_removal ON checklist_assignments;

CREATE TRIGGER trigger_handle_checklist_department_removal
  AFTER DELETE ON checklist_assignments
  FOR EACH ROW
  WHEN (OLD.assigned_to_department_id IS NOT NULL)
  EXECUTE FUNCTION handle_checklist_department_removal();

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå støtter checklist_assignments:
-- 1. Direkte avdelingstildelinger (assigned_to_department_id)
-- 2. Auto-assigned brukertildelinger når avdeling tildeles
-- 3. Automatisk fjerning av auto-assigned tildelinger når avdeling fjernes
-- ============================================================================

