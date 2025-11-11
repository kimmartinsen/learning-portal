-- =====================================================
-- COMPANIES TABLE EXTENSION
-- =====================================================
-- Utvider companies-tabellen med mer bedriftsinformasjon
-- Dato: 2025-11-11

-- Legg til nye kolonner til companies-tabellen
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS org_number VARCHAR(9) UNIQUE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(4),
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS website TEXT;

-- Legg til kommentarer for dokumentasjon
COMMENT ON COLUMN companies.org_number IS 'Norsk organisasjonsnummer (9 siffer)';
COMMENT ON COLUMN companies.address IS 'Bedriftens besøksadresse';
COMMENT ON COLUMN companies.postal_code IS 'Postnummer (4 siffer)';
COMMENT ON COLUMN companies.city IS 'Poststed/by';
COMMENT ON COLUMN companies.phone IS 'Bedriftens telefonnummer';
COMMENT ON COLUMN companies.website IS 'Bedriftens nettside';

-- Oppdater eksisterende companies med placeholder-data hvis nødvendig
-- (Dette kan kjøres trygt selv om kolonnene allerede har data)
UPDATE companies 
SET org_number = NULL 
WHERE org_number = '' OR org_number IS NULL;

-- Legg til indeks for rask søk
CREATE INDEX IF NOT EXISTS idx_companies_org_number ON companies(org_number);
CREATE INDEX IF NOT EXISTS idx_companies_postal_code ON companies(postal_code);

-- =====================================================
-- VALIDERING
-- =====================================================
-- Constraint for å sikre at organisasjonsnummer er 9 siffer
ALTER TABLE companies
DROP CONSTRAINT IF EXISTS check_org_number_format;

ALTER TABLE companies
ADD CONSTRAINT check_org_number_format
CHECK (org_number IS NULL OR (org_number ~ '^\d{9}$'));

-- Constraint for å sikre at postnummer er 4 siffer
ALTER TABLE companies
DROP CONSTRAINT IF EXISTS check_postal_code_format;

ALTER TABLE companies
ADD CONSTRAINT check_postal_code_format
CHECK (postal_code IS NULL OR (postal_code ~ '^\d{4}$'));

