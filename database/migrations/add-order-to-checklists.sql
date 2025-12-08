-- Migration: Legg til order_index på checklists-tabellen
-- Dato: 2025-12-08
-- Formål: Støtte rekkefølge-endring av sjekklister
-- MERK: Kjør ETTER at checklists-tabellen er opprettet (se docs/database-migrations/create-checklists.sql)

-- Sjekk om tabellen eksisterer før vi prøver å legge til kolonnen
DO $$
BEGIN
    -- Sjekk om checklists-tabellen eksisterer
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checklists') THEN
        -- Legg til order_index kolonnen hvis den ikke allerede finnes
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'checklists' AND column_name = 'order_index'
        ) THEN
            ALTER TABLE checklists ADD COLUMN order_index INTEGER DEFAULT 0;
            
            -- Oppdater eksisterende order_index basert på opprettelsesdato
            WITH ordered_checklists AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) - 1 as rn
                FROM checklists
            )
            UPDATE checklists
            SET order_index = ordered_checklists.rn
            FROM ordered_checklists
            WHERE checklists.id = ordered_checklists.id;
            
            RAISE NOTICE 'order_index kolonne lagt til på checklists';
        ELSE
            RAISE NOTICE 'order_index kolonne eksisterer allerede';
        END IF;
    ELSE
        RAISE NOTICE 'checklists tabellen eksisterer ikke. Kjør først: docs/database-migrations/create-checklists.sql';
    END IF;
END $$;

-- Opprett indeks for bedre ytelse (ignorerer feil hvis den allerede finnes)
CREATE INDEX IF NOT EXISTS idx_checklists_order ON checklists(company_id, order_index);
