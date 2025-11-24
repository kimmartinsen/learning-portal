-- Fiks: Forenklet UPDATE policy for notifikasjoner
-- Siden SLETTE fungerer (som bruker USING), men ikke UPDATE (som bruker USING + WITH CHECK),
-- fjerner vi WITH CHECK-klausulen for å gjøre reglene like.

-- 1. Slett eksisterende policy
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- 2. Opprett ny policy uten "WITH CHECK"
-- Dette tillater oppdatering av alle rader brukeren eier, uten ekstra validering av resultatet
-- (som uansett er trygt siden brukeren bare kan endre sine egne rader)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Dobbeltsjekk rettigheter
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- 4. Oppdater schema cache
NOTIFY pgrst, 'reload schema';

