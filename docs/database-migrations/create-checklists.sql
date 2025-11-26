-- ============================================================================
-- OPPRETT SJEKLISTE-SYSTEM
-- ============================================================================
-- Sjekklister er kun for admin, ikke for sluttbrukere
-- Ingen avhengigheter eller rekkefølger
-- ============================================================================

-- 1. CHECKLISTS TABELL
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CHECKLIST_ITEMS TABELL (punkter i sjekklisten)
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEKSER
CREATE INDEX IF NOT EXISTS idx_checklists_company ON checklists(company_id);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON checklists(status);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_order ON checklist_items(checklist_id, order_index);

-- 4. ROW LEVEL SECURITY
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklists
CREATE POLICY "Users view company checklists" ON checklists FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage checklists" ON checklists FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for checklist_items
CREATE POLICY "Users view checklist items" ON checklist_items FOR SELECT 
  USING (checklist_id IN (
    SELECT id FROM checklists 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Admins manage checklist items" ON checklist_items FOR ALL 
  USING (checklist_id IN (
    SELECT id FROM checklists 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ));

-- 5. TRIGGER FOR AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_checklist_updated_at
  BEFORE UPDATE ON checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

CREATE TRIGGER trigger_checklist_item_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_updated_at();

-- 6. TRIGGER FOR Å OPPDATERE CHECKLIST STATUS BASERT PÅ ITEMS
-- Hvis alle items er completed, sett checklist til completed
-- Hvis noen items er in_progress, sett checklist til in_progress
CREATE OR REPLACE FUNCTION update_checklist_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
  v_checklist_id UUID;
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_any_not_started BOOLEAN;
BEGIN
  v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
  
  -- Sjekk status på alle items
  SELECT 
    COUNT(*) = COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'in_progress') > 0,
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'not_started') > 0
  INTO v_all_completed, v_any_in_progress, v_any_not_started
  FROM checklist_items
  WHERE checklist_id = v_checklist_id;
  
  -- Oppdater checklist status
  IF v_all_completed THEN
    UPDATE checklists
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_checklist_id AND status != 'completed';
  ELSIF v_any_in_progress THEN
    UPDATE checklists
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_checklist_id AND status NOT IN ('in_progress', 'completed');
  ELSIF v_any_not_started THEN
    UPDATE checklists
    SET status = 'not_started', updated_at = NOW()
    WHERE id = v_checklist_id AND status = 'completed';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_checklist_status
  AFTER INSERT OR UPDATE OR DELETE ON checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_status_from_items();

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå har du:
-- 1. checklists tabell med status
-- 2. checklist_items tabell med individuelle punkter
-- 3. Automatisk oppdatering av checklist status basert på items
-- 4. RLS policies for sikkerhet
-- 5. Indekser for ytelse
-- ============================================================================

