-- Nye database-tabeller for tema-hierarkiet og individuelle tildelinger

-- 1. THEMES TABLE - Øverste nivå for organisering
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color for UI
  icon VARCHAR(50), -- Lucide icon name
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OPPDATER TRAINING_PROGRAMS - Koble til themes
ALTER TABLE training_programs 
ADD COLUMN theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
DROP COLUMN deadline, -- Flyttes til individuelle tildelinger
DROP COLUMN is_mandatory; -- Flyttes til individuelle tildelinger

-- 3. PROGRAM_ASSIGNMENTS - Erstatter program_departments
CREATE TABLE program_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  
  -- Kan tildeles til enten bruker eller avdeling
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to_department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Tildelingsinformasjon
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Frist og krav
  due_date TIMESTAMPTZ NOT NULL, -- Individuell frist (f.eks. 14 dager fra tildeling)
  is_mandatory BOOLEAN DEFAULT true,
  max_attempts INTEGER DEFAULT 3,
  
  -- Status
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed', 'overdue', 'cancelled')),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT, -- Beskjed fra admin til bruker
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CHECK (
    (assigned_to_user_id IS NOT NULL AND assigned_to_department_id IS NULL) OR
    (assigned_to_user_id IS NULL AND assigned_to_department_id IS NOT NULL)
  ),
  UNIQUE(program_id, assigned_to_user_id), -- En bruker kan bare ha én aktiv tildeling per program
  UNIQUE(program_id, assigned_to_department_id) -- En avdeling kan bare ha én aktiv tildeling per program
);

-- 4. OPPDATER USER_PROGRESS - Koble til assignments
ALTER TABLE user_progress 
ADD COLUMN assignment_id UUID REFERENCES program_assignments(id) ON DELETE CASCADE;

-- 5. VIEWS for enklere queries

-- View for å se alle aktive tildelinger for en bruker
CREATE VIEW user_assignments AS
SELECT 
  pa.*,
  tp.title as program_title,
  tp.description as program_description,
  t.name as theme_name,
  t.color as theme_color,
  -- Beregn status basert på frist
  CASE 
    WHEN pa.completed_at IS NOT NULL THEN 'completed'
    WHEN pa.due_date < NOW() AND pa.completed_at IS NULL THEN 'overdue'
    WHEN pa.status = 'started' THEN 'in_progress'
    ELSE 'not_started'
  END as calculated_status,
  -- Dager igjen til frist
  EXTRACT(DAYS FROM pa.due_date - NOW()) as days_remaining
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
LEFT JOIN themes t ON tp.theme_id = t.id
WHERE pa.status != 'cancelled';

-- View for admin-oversikt over tildelinger
CREATE VIEW assignment_overview AS
SELECT 
  pa.*,
  tp.title as program_title,
  t.name as theme_name,
  COALESCE(u.full_name, d.name) as assigned_to_name,
  CASE 
    WHEN pa.assigned_to_user_id IS NOT NULL THEN 'user'
    ELSE 'department'
  END as assignment_type,
  -- Progress hvis startet
  CASE 
    WHEN EXISTS(SELECT 1 FROM user_progress up WHERE up.assignment_id = pa.id)
    THEN (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE up.status = 'completed') * 100.0) / COUNT(*), 2
      )
      FROM user_progress up 
      WHERE up.assignment_id = pa.id
    )
    ELSE 0
  END as progress_percentage
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
LEFT JOIN themes t ON tp.theme_id = t.id
LEFT JOIN profiles u ON pa.assigned_to_user_id = u.id
LEFT JOIN departments d ON pa.assigned_to_department_id = d.id
WHERE pa.status != 'cancelled';

-- 6. INDEXES for performance
CREATE INDEX idx_themes_company ON themes(company_id);
CREATE INDEX idx_themes_active ON themes(company_id, is_active);
CREATE INDEX idx_programs_theme ON training_programs(theme_id);
CREATE INDEX idx_assignments_user ON program_assignments(assigned_to_user_id);
CREATE INDEX idx_assignments_department ON program_assignments(assigned_to_department_id);
CREATE INDEX idx_assignments_due ON program_assignments(due_date, status);
CREATE INDEX idx_assignments_status ON program_assignments(status, due_date);
CREATE INDEX idx_progress_assignment ON user_progress(assignment_id);

-- 7. ROW LEVEL SECURITY POLICIES

-- Themes policies
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view company themes" ON themes FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins manage themes" ON themes FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Program assignments policies  
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own assignments" ON program_assignments FOR SELECT 
  USING (
    assigned_to_user_id = auth.uid() OR
    assigned_to_department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Admins manage all assignments" ON program_assignments FOR ALL 
  USING (
    EXISTS(
      SELECT 1 FROM profiles p 
      JOIN training_programs tp ON pa.program_id = tp.id 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin' 
      AND p.company_id = tp.company_id
    )
  );
CREATE POLICY "Instructors manage own program assignments" ON program_assignments FOR ALL 
  USING (
    program_id IN (
      SELECT tp.id FROM training_programs tp 
      WHERE tp.instructor_id = auth.uid()
    )
  );

-- Views inherit RLS from underlying tables

-- 8. SAMPLE DATA for testing
INSERT INTO themes (company_id, name, description, color, icon, sort_order) VALUES
-- Hent company_id fra eksisterende data
((SELECT id FROM companies LIMIT 1), 'HMS og Sikkerhet', 'Helse, miljø og sikkerhet opplæring', '#dc2626', 'Shield', 1),
((SELECT id FROM companies LIMIT 1), 'IT-sikkerhet', 'Cybersikkerhet og databehandling', '#7c3aed', 'Lock', 2),
((SELECT id FROM companies LIMIT 1), 'Kundeservice', 'Kundebehandling og kommunikasjon', '#059669', 'Users', 3),
((SELECT id FROM companies LIMIT 1), 'Compliance', 'Regelverk og etikk', '#ea580c', 'Scale', 4);

-- 9. FUNCTIONS for automatic assignment handling

-- Function to create assignments when user joins department
CREATE OR REPLACE FUNCTION create_department_assignments_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- When user gets assigned to department, create individual assignments 
  -- for all department-level program assignments
  INSERT INTO program_assignments (
    program_id, 
    assigned_to_user_id, 
    assigned_by, 
    due_date, 
    is_mandatory,
    max_attempts,
    notes
  )
  SELECT 
    pa.program_id,
    NEW.id,
    pa.assigned_by,
    NOW() + INTERVAL '14 days', -- Default 14 dager frist
    pa.is_mandatory,
    pa.max_attempts,
    'Automatisk tildelt via avdeling: ' || d.name
  FROM program_assignments pa
  JOIN departments d ON pa.assigned_to_department_id = d.id
  WHERE pa.assigned_to_department_id = NEW.department_id
    AND pa.status = 'assigned'
    AND NOT EXISTS (
      SELECT 1 FROM program_assignments pa2 
      WHERE pa2.program_id = pa.program_id 
      AND pa2.assigned_to_user_id = NEW.id
      AND pa2.status != 'cancelled'
    );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_department_assignments
  AFTER INSERT OR UPDATE OF department_id ON profiles
  FOR EACH ROW
  WHEN (NEW.department_id IS NOT NULL)
  EXECUTE FUNCTION create_department_assignments_for_user();

-- Function to update assignment status based on progress
CREATE OR REPLACE FUNCTION update_assignment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When user completes all modules in a program, mark assignment as completed
  IF NEW.status = 'completed' THEN
    UPDATE program_assignments SET 
      status = 'completed',
      completed_at = NOW()
    WHERE id = NEW.assignment_id
    AND status != 'completed'
    AND NOT EXISTS (
      -- Check if there are any incomplete modules left
      SELECT 1 FROM user_progress up2
      WHERE up2.assignment_id = NEW.assignment_id
      AND up2.status != 'completed'
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_assignment_status
  AFTER UPDATE OF status ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_status();
