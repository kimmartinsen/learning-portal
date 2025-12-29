-- ============================================================================
-- FIX: Admins delete assignments policy
-- ============================================================================
-- Problemet: Den eksisterende policyen sjekker kun assigned_to_user_id,
-- men for avdelingstildelinger er assigned_to_user_id NULL.
-- Dette forhindrer admin fra å slette avdelingstildelinger.
-- ============================================================================

-- Dropp den eksisterende policyen
DROP POLICY IF EXISTS "Admins delete assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Admins delete company assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Allow admin to delete assignments" ON public.program_assignments;

-- Opprett ny policy som håndterer både bruker- og avdelingstildelinger
CREATE POLICY "Admins delete assignments" ON public.program_assignments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND (
      -- For brukertildelinger: sjekk brukerens company_id
      (assigned_to_user_id IS NOT NULL AND p.company_id = public.get_user_company_id(assigned_to_user_id))
      OR
      -- For avdelingstildelinger: sjekk avdelingens company_id
      (assigned_to_department_id IS NOT NULL AND p.company_id = (
        SELECT company_id FROM public.departments WHERE id = assigned_to_department_id
      ))
    )
  )
);

-- Verifiser at policyen er opprettet
SELECT 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'program_assignments' 
AND policyname = 'Admins delete assignments';

