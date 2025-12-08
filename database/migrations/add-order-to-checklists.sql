-- Migration: Legg til order_index på checklists-tabellen
-- Dato: 2025-12-08
-- Formål: Støtte rekkefølge-endring av sjekklister

ALTER TABLE checklists
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Oppdater eksisterende order_index basert på opprettelsesdato
WITH ordered_checklists AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) - 1 as rn
  FROM checklists
)
UPDATE checklists
SET order_index = ordered_checklists.rn
FROM ordered_checklists
WHERE checklists.id = ordered_checklists.id;

-- Opprett indeks for bedre ytelse
CREATE INDEX IF NOT EXISTS idx_checklists_order ON checklists(company_id, order_index);

