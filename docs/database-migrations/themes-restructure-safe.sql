-- SIKKER VERSJON: Bruker IF NOT EXISTS og DROP før CREATE
-- Kjør denne versjonen hvis policies allerede eksisterer

-- 1. Opprett themes tabell
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Legg til indekser for themes
CREATE INDEX IF NOT EXISTS idx_themes_company ON themes(company_id);
CREATE INDEX IF NOT EXISTS idx_themes_order ON themes(company_id, order_index);

-- 3. Aktiver RLS for themes
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

-- 4. Drop og gjenopprett RLS policies for themes (sikrere)
DROP POLICY IF EXISTS "Users view company themes" ON themes;
DROP POLICY IF EXISTS "Admins manage themes" ON themes;

CREATE POLICY "Users view company themes" ON themes FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage themes" ON themes FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Legg til theme_id og deadline_days til training_programs
ALTER TABLE training_programs 
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deadline_days INTEGER DEFAULT 14;

-- 6. Legg til indeks for theme_id
CREATE INDEX IF NOT EXISTS idx_programs_theme ON training_programs(theme_id);

-- 7. Trigger for å oppdatere updated_at på themes
CREATE OR REPLACE FUNCTION update_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop og gjenopprett trigger
DROP TRIGGER IF EXISTS themes_updated_at_trigger ON themes;
CREATE TRIGGER themes_updated_at_trigger
  BEFORE UPDATE ON themes
  FOR EACH ROW
  EXECUTE FUNCTION update_themes_updated_at();

-- Kommentarer
COMMENT ON TABLE themes IS 'Temaer som organiserer opplæringsprogrammer hierarkisk';
COMMENT ON COLUMN themes.order_index IS 'Sorteringsrekkefølge for temaer (lavere tall = høyere prioritet)';
COMMENT ON COLUMN training_programs.theme_id IS 'Referanse til tema som programmet tilhører';
COMMENT ON COLUMN training_programs.deadline_days IS 'Antall dager brukere har på å fullføre kurset (standard: 14)';
