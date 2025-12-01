-- Migration: Legg til Tema-nivå (Topics) som høyeste nivå i hierarkiet
-- Hierarki: Topics (Tema) → Themes (Program) → Training Programs (Kurs)

-- 1. Opprett topics-tabellen (Tema)
CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Legg til topic_id på themes-tabellen (Program)
ALTER TABLE themes 
ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

-- 3. Opprett indekser for bedre ytelse
CREATE INDEX IF NOT EXISTS idx_topics_company_id ON topics(company_id);
CREATE INDEX IF NOT EXISTS idx_themes_topic_id ON themes(topic_id);

-- 4. Aktiver RLS på topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- 5. RLS-policyer for topics (dropp eksisterende først for å unngå feil)
DROP POLICY IF EXISTS "Users can view topics in their company" ON topics;
DROP POLICY IF EXISTS "Admins can create topics in their company" ON topics;
DROP POLICY IF EXISTS "Admins can update topics in their company" ON topics;
DROP POLICY IF EXISTS "Admins can delete topics in their company" ON topics;

-- Brukere kan se topics i sitt eget selskap
CREATE POLICY "Users can view topics in their company"
ON topics FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
);

-- Admin kan opprette topics i sitt selskap
CREATE POLICY "Admins can create topics in their company"
ON topics FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Admin kan oppdatere topics i sitt selskap
CREATE POLICY "Admins can update topics in their company"
ON topics FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Admin kan slette topics i sitt selskap
CREATE POLICY "Admins can delete topics in their company"
ON topics FOR DELETE
USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 6. Trigger for å oppdatere updated_at
CREATE OR REPLACE FUNCTION update_topics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS topics_updated_at ON topics;
CREATE TRIGGER topics_updated_at
    BEFORE UPDATE ON topics
    FOR EACH ROW
    EXECUTE FUNCTION update_topics_updated_at();

-- KOMMENTAR: Etter å ha kjørt denne migrasjonen:
-- - Topics = Tema (høyeste nivå)
-- - Themes = Program (knyttes til topic via topic_id)
-- - Training Programs = Kurs (knyttes til theme via theme_id)

