-- Skript for å aktivere Realtime (sanntid) for notifikasjoner
-- Hvis dette ikke er aktivert, vil du ikke få varsler med en gang, men må oppdatere siden.

-- 1. Legg til notifications-tabellen i supabase_realtime publikasjonen
-- Merk: Hvis du får en feilmelding om at "relation matches more than one table" eller lignende,
-- betyr det vanligvis at den allerede er lagt til. Det er i så fall helt fint.
BEGIN;
  -- Vi prøver å legge til tabellen. Hvis den allerede er der, vil dette kanskje gi en warning/error, 
  -- men det sikrer at den er på listen.
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
COMMIT;

-- 2. Sjekk at policies tillater lesing (dette har vi sjekket før, men greit å bekrefte)
-- Users can view their own notifications:
-- USING (auth.uid() = user_id);

