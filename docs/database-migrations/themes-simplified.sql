-- Forenklet database-skjema for tema-hierarki
-- Tema: Kun navn og beskrivelse
-- Kurs: Navn, beskrivelse, frist i dager, ansvarlig, repetisjon

-- 1. OPPRETT THEMES TABEL (forenklet)
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OPPDATER TRAINING_PROGRAMS (kaldt "kurs" nå)
ALTER TABLE training_programs 
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  
  -- Fjern badge og obligatorisk (flyttes til individuell tildeling)
  DROP COLUMN IF EXISTS badge_enabled,
  DROP COLUMN IF EXISTS is_mandatory,
  DROP COLUMN IF EXISTS deadline,
  
  -- Legg til nye felt
  ADD COLUMN IF NOT EXISTS frist_dager INTEGER, -- Antall dager fra tildeling
  ADD COLUMN IF NOT EXISTS ansvarlig_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Ansvarlig instruktør/admin
  ADD COLUMN IF NOT EXISTS repetisjon_aktivert BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS repetisjon_interval INTEGER; -- Antall måneder mellom repetisjoner

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_themes_company ON themes(company_id);
CREATE INDEX IF NOT EXISTS idx_programs_theme ON training_programs(theme_id);

-- 4. ROW LEVEL SECURITY
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company themes" ON themes FOR SELECT 
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins manage themes" ON themes FOR ALL 
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. FUNKSJON: Auto-oppdatering av updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_themes_updated_at
  BEFORE UPDATE ON themes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. VIEW for kurs med tema-info
CREATE OR REPLACE VIEW courses_with_themes AS
SELECT 
  tp.*,
  t.name as theme_name,
  t.description as theme_description,
  p.full_name as ansvarlig_navn,
  COUNT(DISTINCT m.id) as antall_moduler
FROM training_programs tp
LEFT JOIN themes t ON tp.theme_id = t.id
LEFT JOIN profiles p ON tp.ansvarlig_id = p.id
LEFT JOIN modules m ON m.program_id = tp.id
GROUP BY tp.id, t.name, t.description, p.full_name;

-- 7. SAMPLE DATA (valgfritt)
-- INSERT INTO themes (company_id, name, description) 
-- VALUES ((SELECT id FROM companies LIMIT 1), 'HMS', 'Helse, miljø og sikkerhet');
