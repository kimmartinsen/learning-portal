-- ============================================================================
-- LEGG TIL EKSTRA KOLONNER I COMPANIES-TABELLEN
-- ============================================================================
-- Legger til: org_number, address, phone, contact_email
-- ============================================================================

-- Legg til kolonner (ignorerer feil hvis de allerede eksisterer)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS org_number VARCHAR(20);

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);

-- ============================================================================
-- FERDIG! Nye kolonner er lagt til.
-- ============================================================================

