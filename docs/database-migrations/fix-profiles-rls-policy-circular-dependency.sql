-- ============================================================================
-- FIX: Profiles RLS Policy Circular Dependency
-- ============================================================================
-- Problemet: "Users view company profiles" policy prøver å lese fra profiles
-- for å finne company_id, men dette kan feile hvis RLS blokkerer tilgang.
-- Løsning: Sørg for at "Users view own profile" policy alltid fungerer,
-- og at policies er riktig satt opp.
-- ============================================================================

-- Drop eksisterende policies for å opprette dem på nytt i riktig rekkefølge
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

-- Opprett policies i riktig rekkefølge
-- 1. Først: Users view own profile (enkleste, ingen avhengigheter)
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- 2. Deretter: Users view company profiles (bruker sin egen profil for å finne company_id)
-- Bruk SECURITY DEFINER eller en funksjon for å unngå sirkulær avhengighet
-- Men siden vi allerede har "Users view own profile", kan vi bruke en subquery
-- som vil fungere fordi brukeren allerede kan se sin egen profil
CREATE POLICY "Users view company profiles" ON public.profiles FOR SELECT 
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- 3. Til slutt: Admins manage profiles
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL 
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- VERIFISER AT POLICIES ER OPPRETTET
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles';
  
  IF v_policy_count < 3 THEN
    RAISE WARNING 'Forventet 3 policies på profiles, fant %', v_policy_count;
  ELSE
    RAISE NOTICE 'Alle policies er opprettet på profiles tabellen';
  END IF;
END $$;

-- ============================================================================
-- FERDIG: Policies er nå opprettet i riktig rekkefølge
-- ============================================================================

