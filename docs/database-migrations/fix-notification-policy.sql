-- Fix: Sørg for at brukere kan oppdatere egne notifikasjoner (markere som lest)
-- Vi legger til en spesifikk policy for UPDATE som er mer liberal for egne rader

-- 1. Slett eksisterende UPDATE policy for sikkerhets skyld
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- 2. Opprett ny policy
-- Merk: For UPDATE trenger vi ofte både USING (for å finne raden) og WITH CHECK (for å validere den nye tilstanden)
-- I dette tilfellet skal brukeren kunne oppdatere *hva som helst* på sin egen rad (f.eks. read = true)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Sjekk også at RLS er aktivert (skal være det, men for sikkerhets skyld)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

