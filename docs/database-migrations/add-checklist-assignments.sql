-- ============================================================================
-- LEGG TIL TILDELINGER AV SJEKLISTER TIL BRUKERE
-- ============================================================================
-- Admin kan tildele sjekklister til brukere
-- Hver bruker har sin egen status per punkt
-- ============================================================================

-- 1. CHECKLIST_ASSIGNMENTS TABELL (tildelinger)
CREATE TABLE IF NOT EXISTS checklist_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE NOT NULL,
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(checklist_id, assigned_to_user_id)
);

-- 2. CHECKLIST_ITEM_STATUS TABELL (status per bruker per punkt)
CREATE TABLE IF NOT EXISTS checklist_item_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES checklist_assignments(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES checklist_items(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, item_id)
);

-- 3. INDEKSER
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_checklist ON checklist_assignments(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_user ON checklist_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_status ON checklist_assignments(status);
CREATE INDEX IF NOT EXISTS idx_checklist_item_status_assignment ON checklist_item_status(assignment_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_status_item ON checklist_item_status(item_id);

-- 4. ROW LEVEL SECURITY
ALTER TABLE checklist_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_item_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklist_assignments
CREATE POLICY "Users view their own checklist assignments" ON checklist_assignments FOR SELECT 
  USING (
    assigned_to_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM checklists c
      WHERE c.id = checklist_assignments.checklist_id
      AND c.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Admins manage checklist assignments" ON checklist_assignments FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM checklists c
      WHERE c.id = checklist_assignments.checklist_id
      AND c.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- RLS Policies for checklist_item_status
CREATE POLICY "Users view their own checklist item status" ON checklist_item_status FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM checklist_assignments ca
      WHERE ca.id = checklist_item_status.assignment_id
      AND (
        ca.assigned_to_user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM checklists c
          WHERE c.id = ca.checklist_id
          AND c.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
      )
    )
  );

CREATE POLICY "Admins manage checklist item status" ON checklist_item_status FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM checklist_assignments ca
      JOIN checklists c ON c.id = ca.checklist_id
      WHERE ca.id = checklist_item_status.assignment_id
      AND c.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- 5. TRIGGER FOR AUTO-UPDATE updated_at
CREATE TRIGGER trigger_checklist_assignment_updated_at
  BEFORE UPDATE ON checklist_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

CREATE TRIGGER trigger_checklist_item_status_updated_at
  BEFORE UPDATE ON checklist_item_status
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

-- 6. TRIGGER FOR Å OPPDATERE ASSIGNMENT STATUS BASERT PÅ ITEM STATUS
-- Hvis alle items er completed, sett assignment til completed
CREATE OR REPLACE FUNCTION update_checklist_assignment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment_id UUID;
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_any_not_started BOOLEAN;
  v_total_items INTEGER;
  v_completed_items INTEGER;
BEGIN
  v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Sjekk status på alle items for denne assignment
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) = COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'in_progress') > 0,
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'not_started') > 0
  INTO v_total_items, v_completed_items, v_all_completed, v_any_in_progress, v_any_not_started
  FROM checklist_item_status
  WHERE assignment_id = v_assignment_id;
  
  -- Oppdater assignment status
  IF v_all_completed AND v_total_items > 0 THEN
    UPDATE checklist_assignments
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_assignment_id AND status != 'completed';
  ELSIF v_any_in_progress THEN
    UPDATE checklist_assignments
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_assignment_id AND status NOT IN ('in_progress', 'completed');
  ELSIF v_any_not_started AND v_completed_items = 0 THEN
    UPDATE checklist_assignments
    SET status = 'not_started', completed_at = NULL, updated_at = NOW()
    WHERE id = v_assignment_id AND status = 'completed';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_checklist_assignment_status
  AFTER INSERT OR UPDATE OR DELETE ON checklist_item_status
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_assignment_status();

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå har du:
-- 1. checklist_assignments - tildelinger av sjekklister til brukere
-- 2. checklist_item_status - status per bruker per punkt
-- 3. Automatisk oppdatering av assignment status basert på item status
-- 4. RLS policies for sikkerhet
-- ============================================================================

