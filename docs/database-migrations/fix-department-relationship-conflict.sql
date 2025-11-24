-- Migrering: Fjern department_id fra profiles for å løse relasjonskonflikten
-- Dato: 2025-11-24
-- Formål: Fjerne den gamle department_id kolonnen fra profiles for å unngå
--         konflikt med user_departments many-to-many relasjonen

-- VIKTIG: Dette fjerner den gamle department_id kolonnen fra profiles.
-- Alle avdelingsrelasjoner håndteres nå via user_departments tabellen.
-- Kjør kun denne migreringen hvis du har verifisert at user_departments 
-- inneholder alle nødvendige data.

-- 1. Verifiser først at data er migrert til user_departments
-- Kjør denne SELECT for å sjekke:
-- SELECT COUNT(*) FROM profiles WHERE department_id IS NOT NULL;
-- SELECT COUNT(*) FROM user_departments;
-- Hvis antallene matcher (eller user_departments har flere), er du trygg.

-- 2. Slett foreign key constraint først
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_department_id_fkey;

-- 3. Slett department_id kolonnen
ALTER TABLE profiles DROP COLUMN IF EXISTS department_id;

-- 4. Oppdater schema cache
NOTIFY pgrst, 'reload schema';

-- FERDIG!
-- Etter denne migreringen vil Supabase kun bruke user_departments relasjonen,
-- og feilen "more than one relationship was found" vil forsvinne.

