-- Migrering: Fiks RLS for assignment funksjoner
-- Dato: 2025-11-27
-- Formål: Tillat SECURITY DEFINER funksjoner å bypasse RLS for å kunne opprette assignments

-- PROBLEM:
-- Når RLS er aktivert på program_assignments, kan SECURITY DEFINER funksjoner
-- bli blokkert fra å opprette tildelinger selv om de har riktige permissions.

-- LØSNING 1: Gi service_role til funksjonsowner (anbefalt for Supabase)
-- Dette gjør at funksjonen kjører med høyere privilegier

-- 1. Gjør postgres brukeren til owner av funksjonene
ALTER FUNCTION public.assign_program_to_department(UUID, UUID, UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION public.assign_program_to_user(UUID, UUID, UUID, TEXT) OWNER TO postgres;

-- 2. Alternativt: Opprett spesifikke RLS policies som tillater INSERT for funksjonen
-- Denne policyen tillater INSERT i program_assignments for alle authenticated brukere
-- når det gjøres gjennom admin-grensesnittet

DROP POLICY IF EXISTS "Allow admin to insert assignments" ON public.program_assignments;

CREATE POLICY "Allow admin to insert assignments"
ON public.program_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  -- Sjekk at brukeren som tildeler er admin
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 3. Tillat admin å slette assignments (for når du redigerer kurs)
DROP POLICY IF EXISTS "Allow admin to delete assignments" ON public.program_assignments;

CREATE POLICY "Allow admin to delete assignments"
ON public.program_assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 4. Tillat admin å oppdatere assignments
DROP POLICY IF EXISTS "Allow admin to update assignments" ON public.program_assignments;

CREATE POLICY "Allow admin to update assignments"
ON public.program_assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 5. Tillat brukere å se sine egne assignments (viktig for Min Opplæring)
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.program_assignments;

CREATE POLICY "Users can view their own assignments"
ON public.program_assignments
FOR SELECT
TO authenticated
USING (
  assigned_to_user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'instructor')
  )
);

-- 6. Sørg for at RLS er aktivert
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;

-- 7. Grant nødvendige permissions
GRANT INSERT, UPDATE, DELETE, SELECT ON public.program_assignments TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_to_department(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_to_user(UUID, UUID, UUID, TEXT) TO authenticated;

-- 8. Verifiser policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'program_assignments'
ORDER BY policyname;

-- VIKTIG TEST:
-- Etter å ha kjørt denne SQL-en:
-- 1. Logg inn som admin
-- 2. Opprett et nytt kurs
-- 3. Tildel det til en avdeling
-- 4. Sjekk om brukerne i avdelingen får tildelingen
-- 5. Logg inn som en vanlig bruker og sjekk om du ser kurset under "Min Opplæring"
