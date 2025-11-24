-- Fix for manglende metadata-kolonne i notifications-tabellen
-- Dette skriptet legger til kolonnen hvis den mangler og oppdaterer schema cache

-- 1. Legg til metadata-kolonnen
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Oppfrisk schema cache (PostgREST)
-- Dette tvinger API-et til å oppdage den nye kolonnen
NOTIFY pgrst, 'reload schema';

