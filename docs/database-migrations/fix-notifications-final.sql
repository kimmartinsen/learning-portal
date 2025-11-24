-- ENDELIG FIKS for notifikasjoner
-- Kjør hele dette skriptet i Supabase SQL Editor for å fikse "Kunne ikke markere som lest"

-- 1. Aktiver RLS (Sikkerhet)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Gi nødvendige rettigheter til innloggede brukere
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- 3. Slett ALLE gamle update-regler for å unngå konflikter
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;

-- 4. Opprett en ny, vanntett regel for oppdatering
-- Denne sier eksplisitt: En bruker kan oppdatere en rad HVIS brukerens ID matcher radens user_id
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Sørg for at "updated_at" triggeren fungerer
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Oppdater cachen til API-et
NOTIFY pgrst, 'reload schema';

