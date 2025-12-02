-- ============================================================================
-- LEGG TIL POSTNUMMER OG STED I COMPANIES-TABELLEN
-- ============================================================================

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- ============================================================================
-- FERDIG! Nye kolonner er lagt til.
-- ============================================================================

