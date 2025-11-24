-- Omfattende fiks for notifikasjonsproblemer
-- Dette skriptet fikser rettigheter, funksjoner og regler (RLS) for notifikasjoner.

-- 1. Sørg for at "updated_at" funksjonen eksisterer
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Gi eksplisitte rettigheter til å endre tabellen
-- Hvis disse mangler, vil RLS sjekkene aldri engang kjøres
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO service_role;

-- 3. Tilbakestill og opprett oppdaterings-policy på nytt
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Sjekk at triggeren for tidsstempel er korrekt
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Oppfrisk schema cache for sikkerhets skyld
NOTIFY pgrst, 'reload schema';

