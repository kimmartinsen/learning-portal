-- ============================================================================
-- LEGG TIL must_change_password FLAG
-- ============================================================================
-- Brukere opprettet av admin må endre passord ved første innlogging
-- ============================================================================

-- Legg til kolonne i profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Oppdater eksisterende brukere til false (de har allerede satt passord)
UPDATE profiles SET must_change_password = false WHERE must_change_password IS NULL;

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================

