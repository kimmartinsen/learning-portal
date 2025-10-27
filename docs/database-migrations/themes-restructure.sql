-- Migrering: Tema-hierarki og kurs-endringer
-- Dato: 2025-10-27
-- Formål: Innføre tema som overordnet nivå og fjerne obligatorisk/badge fra kurs

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

-- 4. Opprett RLS policies for themes
CREATE POLICY "Users view company themes" ON themes FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage themes" ON themes FOR ALL 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Legg til theme_id og deadline_days til training_programs
ALTER TABLE training_programs 
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deadline_days INTEGER DEFAULT 14;

-- 6. Fjern gamle felter fra training_programs (sikkerhetskopiér først!)
-- Kommentert ut for sikkerhet - kjør manuelt etter testing
-- ALTER TABLE training_programs 
--   DROP COLUMN IF EXISTS is_mandatory,
--   DROP COLUMN IF EXISTS badge_enabled,
--   DROP COLUMN IF EXISTS deadline;

-- 7. Legg til indeks for theme_id
CREATE INDEX IF NOT EXISTS idx_programs_theme ON training_programs(theme_id);

-- 8. Opprett view for enkel fetching av programmer med tema-info
CREATE OR REPLACE VIEW programs_with_themes AS
SELECT 
  tp.*,
  t.name as theme_name,
  t.description as theme_description,
  t.order_index as theme_order
FROM training_programs tp
LEFT JOIN themes t ON tp.theme_id = t.id;

-- 9. Oppdater existing training_programs policies (hvis nødvendig)
-- De eksisterende policies fungerer fortsatt, men vi kan legge til tema-spesifikke senere

-- 10. Trigger for å oppdatere updated_at på themes
CREATE OR REPLACE FUNCTION update_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER themes_updated_at_trigger
  BEFORE UPDATE ON themes
  FOR EACH ROW
  EXECUTE FUNCTION update_themes_updated_at();

-- 11. Opprett default theme for eksisterende data (valgfritt)
-- INSERT INTO themes (company_id, name, description, order_index)
-- SELECT DISTINCT company_id, 'Generell opplæring', 'Standard tema for eksisterende kurs', 0
-- FROM training_programs
-- WHERE company_id NOT IN (SELECT company_id FROM themes);

-- 12. Oppdater eksisterende programmer til å bruke default theme (valgfritt)
-- UPDATE training_programs 
-- SET theme_id = (
--   SELECT id FROM themes 
--   WHERE themes.company_id = training_programs.company_id 
--   AND themes.name = 'Generell opplæring'
-- )
-- WHERE theme_id IS NULL;

COMMENT ON TABLE themes IS 'Temaer som organiserer opplæringsprogrammer hierarkisk';
COMMENT ON COLUMN themes.order_index IS 'Sorteringsrekkefølge for temaer (lavere tall = høyere prioritet)';
COMMENT ON COLUMN training_programs.theme_id IS 'Referanse til tema som programmet tilhører';
COMMENT ON COLUMN training_programs.deadline_days IS 'Antall dager brukere har på å fullføre kurset (standard: 14)';
