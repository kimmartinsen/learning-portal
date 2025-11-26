-- ============================================================================
-- FIX: Legg til CASCADE på user_progress foreign keys
-- ============================================================================
-- Dette sikrer at user_progress rader slettes automatisk når relaterte
-- training_programs, modules eller profiles slettes
-- ============================================================================

-- 1. SJEKK EKSISTERENDE CONSTRAINTS
-- Du kan se eksisterende constraints med:
-- SELECT conname, conrelid::regclass, confrelid::regclass, confdeltype 
-- FROM pg_constraint 
-- WHERE conrelid = 'user_progress'::regclass AND contype = 'f';

-- 2. DROPP EKSISTERENDE FOREIGN KEY CONSTRAINTS (hvis de ikke har CASCADE)
ALTER TABLE user_progress 
  DROP CONSTRAINT IF EXISTS user_progress_program_id_fkey,
  DROP CONSTRAINT IF EXISTS user_progress_module_id_fkey,
  DROP CONSTRAINT IF EXISTS user_progress_user_id_fkey;

-- 3. LEGG TIL NYE CONSTRAINTS MED CASCADE
ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_program_id_fkey 
    FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE,
  
  ADD CONSTRAINT user_progress_module_id_fkey 
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  
  ADD CONSTRAINT user_progress_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. RYDD OPP I FORELDRELØSE RADER
-- Slett user_progress rader som refererer til ikke-eksisterende training_programs
DELETE FROM user_progress
WHERE program_id NOT IN (SELECT id FROM training_programs);

-- Slett user_progress rader som refererer til ikke-eksisterende modules
DELETE FROM user_progress
WHERE module_id NOT IN (SELECT id FROM modules);

-- Slett user_progress rader som refererer til ikke-eksisterende profiles
DELETE FROM user_progress
WHERE user_id NOT IN (SELECT id FROM profiles);

-- ============================================================================
-- RESULTAT
-- ============================================================================
-- Nå vil user_progress rader automatisk slettes når:
-- - Et kurs (training_program) slettes
-- - En modul slettes
-- - En bruker (profile) slettes
-- ============================================================================

