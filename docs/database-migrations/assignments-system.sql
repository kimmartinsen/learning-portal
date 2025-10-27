-- Migrering: Fleksibelt tildelingssystem (avdeling + individuelt)
-- Dato: 2025-10-27
-- Formål: Implementere tildelinger med personlige frister og auto-tildeling

-- 1. Opprett program_assignments tabell
CREATE TABLE IF NOT EXISTS program_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  
  -- Target (enten bruker ELLER avdeling)
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to_department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Metadata
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Personlig frist (beregnet fra assigned_at + program.deadline_days)
  due_date TIMESTAMPTZ NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed', 'overdue', 'cancelled')),
  completed_at TIMESTAMPTZ,
  
  -- Ekstra info
  notes TEXT,
  is_auto_assigned BOOLEAN DEFAULT false, -- Satt til true når auto-tildelt via avdeling
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: enten user ELLER department, ikke begge
  CONSTRAINT assignment_target_check CHECK (
    (assigned_to_user_id IS NOT NULL AND assigned_to_department_id IS NULL) OR
    (assigned_to_user_id IS NULL AND assigned_to_department_id IS NOT NULL)
  )
);

-- 2. Indekser for program_assignments
CREATE INDEX IF NOT EXISTS idx_assignments_program ON program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON program_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_department ON program_assignments(assigned_to_department_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON program_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON program_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON program_assignments(assigned_by);

-- 3. RLS for program_assignments
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;

-- Brukere kan se egne tildelinger
CREATE POLICY "Users view own assignments" ON program_assignments FOR SELECT 
  USING (assigned_to_user_id = auth.uid());

-- Brukere kan oppdatere egne tildelinger (status og completed_at)
CREATE POLICY "Users update own assignments" ON program_assignments FOR UPDATE 
  USING (assigned_to_user_id = auth.uid())
  WITH CHECK (assigned_to_user_id = auth.uid());

-- Admins kan se alle tildelinger i bedriften
CREATE POLICY "Admins view company assignments" ON program_assignments FOR SELECT 
  USING (
    program_id IN (
      SELECT id FROM training_programs 
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Admins kan administrere alle tildelinger i bedriften
CREATE POLICY "Admins manage company assignments" ON program_assignments FOR ALL 
  USING (
    program_id IN (
      SELECT id FROM training_programs 
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Instruktører kan se tildelinger for egne kurs
CREATE POLICY "Instructors view own program assignments" ON program_assignments FOR SELECT 
  USING (
    program_id IN (
      SELECT id FROM training_programs WHERE instructor_id = auth.uid()
    )
  );

-- 4. View for user assignments med all nødvendig info
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
  
  -- Program info
  tp.title as program_title,
  tp.description as program_description,
  tp.deadline_days,
  
  -- Theme info
  t.name as theme_name,
  
  -- Days remaining calculation
  CASE 
    WHEN pa.status = 'completed' THEN 0
    WHEN pa.due_date < NOW() THEN 0
    ELSE EXTRACT(EPOCH FROM (pa.due_date - NOW())) / 86400 
  END::INTEGER as days_remaining,
  
  -- Calculated status
  CASE 
    WHEN pa.status = 'completed' THEN 'completed'
    WHEN pa.due_date < NOW() AND pa.status != 'completed' THEN 'overdue'
    WHEN pa.status = 'started' THEN 'in_progress'
    ELSE 'not_started'
  END as calculated_status,
  
  -- Progress from user_progress table
  COALESCE(
    (SELECT COUNT(*)::FLOAT / NULLIF(
      (SELECT COUNT(*) FROM modules WHERE program_id = tp.id), 0
    ) * 100)::INTEGER, 0
  ) as progress_percentage
  
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
LEFT JOIN themes t ON tp.theme_id = t.id
WHERE pa.assigned_to_user_id IS NOT NULL;

-- 5. View for department assignments
CREATE OR REPLACE VIEW department_assignments AS
SELECT 
  pa.id,
  pa.program_id,
  pa.assigned_to_department_id as department_id,
  pa.assigned_by,
  pa.assigned_at,
  pa.notes,
  
  -- Program info
  tp.title as program_title,
  tp.description as program_description,
  tp.deadline_days,
  
  -- Theme info
  t.name as theme_name,
  
  -- Department info
  d.name as department_name,
  
  -- Count of users in department
  (SELECT COUNT(*) FROM profiles WHERE department_id = pa.assigned_to_department_id) as user_count,
  
  -- Count of completed assignments from this department assignment
  (SELECT COUNT(*) 
   FROM program_assignments pa2 
   WHERE pa2.program_id = pa.program_id 
   AND pa2.assigned_to_user_id IN (
     SELECT id FROM profiles WHERE department_id = pa.assigned_to_department_id
   )
   AND pa2.status = 'completed'
  ) as completed_count
  
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
JOIN departments d ON pa.assigned_to_department_id = d.id
LEFT JOIN themes t ON tp.theme_id = t.id
WHERE pa.assigned_to_department_id IS NOT NULL;

-- 6. Funksjon for å opprette individuell tildeling
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
BEGIN
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
$$ LANGUAGE plpgsql;

-- 7. Funksjon for å opprette avdelingstildeling
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
  FOR v_user_record IN 
    SELECT id FROM profiles WHERE department_id = p_department_id
  LOOP
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
  END LOOP;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger for auto-tildeling når brukere legges til avdeling
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

CREATE TRIGGER trigger_auto_assign_department_programs
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_department_programs();

-- 9. Funksjon for å oppdatere assignment status basert på user_progress
CREATE OR REPLACE FUNCTION update_assignment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment_id UUID;
  v_total_modules INTEGER;
  v_completed_modules INTEGER;
BEGIN
  -- Finn relatert assignment
  SELECT id INTO v_assignment_id
  FROM program_assignments 
  WHERE assigned_to_user_id = NEW.user_id 
  AND program_id = NEW.program_id
  ORDER BY assigned_at DESC -- Ta nyeste hvis det er flere
  LIMIT 1;
  
  IF v_assignment_id IS NOT NULL THEN
    -- Tell totale og fullførte moduler
    SELECT COUNT(*) INTO v_total_modules
    FROM modules WHERE program_id = NEW.program_id;
    
    SELECT COUNT(*) INTO v_completed_modules
    FROM user_progress 
    WHERE user_id = NEW.user_id 
    AND program_id = NEW.program_id 
    AND status = 'completed';
    
    -- Oppdater assignment status
    IF v_completed_modules >= v_total_modules AND v_total_modules > 0 THEN
      -- Program fullført
      UPDATE program_assignments 
      SET status = 'completed', completed_at = NOW()
      WHERE id = v_assignment_id;
    ELSIF NEW.status = 'in_progress' OR NEW.status = 'completed' THEN
      -- Program startet
      UPDATE program_assignments 
      SET status = 'started'
      WHERE id = v_assignment_id AND status = 'assigned';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assignment_status
  AFTER INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_status();

-- 10. Comments for documentation
COMMENT ON TABLE program_assignments IS 'Tildelinger av programmer til brukere eller avdelinger med personlige frister';
COMMENT ON COLUMN program_assignments.assigned_to_user_id IS 'Individuell tildeling til bruker';
COMMENT ON COLUMN program_assignments.assigned_to_department_id IS 'Avdelingstildeling (genererer individuelle tildelinger)';
COMMENT ON COLUMN program_assignments.is_auto_assigned IS 'TRUE hvis automatisk tildelt via avdeling';
COMMENT ON COLUMN program_assignments.due_date IS 'Personlig frist beregnet fra assigned_at + deadline_days';

-- 11. Fjern gammel program_departments tabell (valgfritt - kan kommenteres ut)
-- DROP TABLE IF EXISTS program_departments;
