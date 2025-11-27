-- ============================================================================
-- LEGG TIL STØTTE FOR FYSISKE KURS
-- ============================================================================
-- Fysiske kurs fungerer som sjekklister med punkter som kan sjekkes av
-- Instruktører kan bekrefte at kurs er gjennomført
-- ============================================================================

-- 1. LEGG TIL course_type I training_programs
ALTER TABLE training_programs
ADD COLUMN IF NOT EXISTS course_type VARCHAR(50) DEFAULT 'e-course' 
  CHECK (course_type IN ('e-course', 'physical-course'));

COMMENT ON COLUMN training_programs.course_type IS 
  'Type kurs: e-course (nettbasert) eller physical-course (fysisk kurs med sjekkliste)';

-- 2. OPPRETT course_items TABELL (punkter for fysiske kurs)
CREATE TABLE IF NOT EXISTS course_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. OPPRETT course_item_status TABELL (status per bruker per punkt)
CREATE TABLE IF NOT EXISTS course_item_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES program_assignments(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES course_items(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, item_id)
);

-- 4. INDEKSER
CREATE INDEX IF NOT EXISTS idx_course_items_program ON course_items(program_id);
CREATE INDEX IF NOT EXISTS idx_course_items_order ON course_items(program_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_item_status_assignment ON course_item_status(assignment_id);
CREATE INDEX IF NOT EXISTS idx_course_item_status_item ON course_item_status(item_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_course_type ON training_programs(course_type);

-- 5. ROW LEVEL SECURITY
ALTER TABLE course_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_item_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_items
CREATE POLICY "Users view company course items" ON course_items FOR SELECT 
  USING (
    program_id IN (
      SELECT id FROM training_programs 
      WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins and instructors manage course items" ON course_items FOR ALL 
  USING (
    program_id IN (
      SELECT id FROM training_programs 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'instructor')
      )
    )
  );

-- RLS Policies for course_item_status
CREATE POLICY "Users view their own course item status" ON course_item_status FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM program_assignments pa
      WHERE pa.id = course_item_status.assignment_id
      AND (
        pa.assigned_to_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM training_programs tp
          WHERE tp.id IN (
            SELECT program_id FROM course_items WHERE id = course_item_status.item_id
          )
          AND tp.company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor')
          )
        )
      )
    )
  );

CREATE POLICY "Admins and instructors manage course item status" ON course_item_status FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM program_assignments pa
      JOIN course_items ci ON ci.id = course_item_status.item_id
      JOIN training_programs tp ON tp.id = ci.program_id
      WHERE pa.id = course_item_status.assignment_id
      AND tp.company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'instructor')
      )
      AND (
        -- Admin kan alltid oppdatere
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = auth.uid() AND role = 'admin' AND company_id = tp.company_id
        )
        OR
        -- Instruktør kan oppdatere hvis de er instruktør for kurset
        (
          tp.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'instructor' AND company_id = tp.company_id
          )
        )
      )
    )
  );

-- 6. TRIGGER FOR AUTO-UPDATE updated_at
CREATE TRIGGER trigger_course_item_updated_at
  BEFORE UPDATE ON course_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

CREATE TRIGGER trigger_course_item_status_updated_at
  BEFORE UPDATE ON course_item_status
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

-- 7. TRIGGER FOR Å OPPDATERE PROGRAM_ASSIGNMENT STATUS BASERT PÅ ITEM STATUS
-- For fysiske kurs: Hvis alle items er completed, sett assignment til completed
CREATE OR REPLACE FUNCTION update_physical_course_assignment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment_id UUID;
  v_program_id UUID;
  v_course_type VARCHAR(50);
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_total_items INTEGER;
  v_completed_items INTEGER;
BEGIN
  v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Hent program_id fra item
  SELECT ci.program_id INTO v_program_id
  FROM course_items ci
  WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
  
  -- Sjekk om dette er et fysisk kurs
  SELECT course_type INTO v_course_type
  FROM training_programs
  WHERE id = v_program_id;
  
  -- Kun håndter fysiske kurs
  IF v_course_type != 'physical-course' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Sjekk status på alle items for denne assignment
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) = COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'in_progress') > 0
  INTO v_total_items, v_completed_items, v_all_completed, v_any_in_progress
  FROM course_item_status
  WHERE assignment_id = v_assignment_id;
  
  -- Oppdater assignment status
  IF v_all_completed AND v_total_items > 0 THEN
    UPDATE program_assignments
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_assignment_id AND status != 'completed';
  ELSIF v_any_in_progress THEN
    UPDATE program_assignments
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_assignment_id AND status NOT IN ('in_progress', 'completed');
  ELSIF v_completed_items = 0 THEN
    UPDATE program_assignments
    SET status = 'assigned', completed_at = NULL, updated_at = NOW()
    WHERE id = v_assignment_id AND status = 'completed';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_physical_course_assignment_status
  AFTER INSERT OR UPDATE OR DELETE ON course_item_status
  FOR EACH ROW
  EXECUTE FUNCTION update_physical_course_assignment_status();

-- 8. TRIGGER FOR Å OPPRETTE course_item_status NÅR NY ASSIGNMENT OPPRETTES
-- For fysiske kurs: Opprett item_status for alle items når en bruker får kurset tildelt
CREATE OR REPLACE FUNCTION create_course_item_status_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_course_type VARCHAR(50);
  v_items RECORD;
BEGIN
  -- Sjekk om dette er et fysisk kurs
  SELECT course_type INTO v_course_type
  FROM training_programs
  WHERE id = NEW.program_id;
  
  -- Kun håndter fysiske kurs
  IF v_course_type != 'physical-course' THEN
    RETURN NEW;
  END IF;
  
  -- Opprett item_status for alle items i kurset
  FOR v_items IN 
    SELECT id FROM course_items 
    WHERE program_id = NEW.program_id
    ORDER BY order_index
  LOOP
    INSERT INTO course_item_status (assignment_id, item_id, status)
    VALUES (NEW.id, v_items.id, 'not_started')
    ON CONFLICT (assignment_id, item_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_course_item_status
  AFTER INSERT ON program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION create_course_item_status_on_assignment();

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå har du:
-- 1. course_type i training_programs (e-course eller physical-course)
-- 2. course_items - punkter for fysiske kurs
-- 3. course_item_status - status per bruker per punkt
-- 4. Automatisk opprettelse av item_status når kurs tildeles
-- 5. Automatisk oppdatering av assignment status basert på item status
-- 6. RLS policies som lar instruktører oppdatere status for sine kurs
-- ============================================================================

