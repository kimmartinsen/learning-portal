-- ============================================================================
-- FIX: Complete RLS Fix for Login Flow
-- ============================================================================
-- Dette skriptet sikrer at RLS-policies er riktig satt opp slik at brukere
-- kan hente sin egen profil etter innlogging. Dette er kritisk for at
-- applikasjonen skal fungere.
-- ============================================================================

-- ============================================================================
-- 1. SIKRE AT RLS ER AKTIVERT PÅ PROFILES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. FJERN ALLE EKSISTERENDE POLICIES FOR Å STARTE PÅ NYTT
-- ============================================================================

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

-- ============================================================================
-- 3. OPPRETT POLICIES I RIKTIG REKKEFØLGE
-- ============================================================================

-- Policy 1: Users view own profile (MÅ være først, ingen avhengigheter)
-- Dette er den viktigste policyen - den må alltid fungere
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- Policy 2: Users view company profiles
-- Bruker subquery som avhenger av Policy 1, men dette skal fungere
-- fordi brukeren allerede kan se sin egen profil
CREATE POLICY "Users view company profiles" ON public.profiles FOR SELECT 
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy 3: Admins manage profiles (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
      AND p.company_id = profiles.company_id
    )
  );

-- ============================================================================
-- 4. SIKRE AT COMPANIES RLS ER RIKTIG SATT OPP
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop eksisterende policies
DROP POLICY IF EXISTS "Users view own company" ON public.companies;
DROP POLICY IF EXISTS "Admins update company" ON public.companies;

-- Users view own company (må fungere for JOIN i profil-query)
CREATE POLICY "Users view own company" ON public.companies FOR SELECT 
  USING (
    id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Admins update company
CREATE POLICY "Admins update company" ON public.companies FOR UPDATE 
  USING (
    id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- 5. VERIFISER AT POLICIES ER OPPRETTET
-- ============================================================================

DO $$
DECLARE
  v_profiles_policy_count INTEGER;
  v_companies_policy_count INTEGER;
BEGIN
  -- Sjekk profiles policies
  SELECT COUNT(*) INTO v_profiles_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles';
  
  IF v_profiles_policy_count < 3 THEN
    RAISE WARNING 'Forventet 3 policies på profiles, fant %', v_profiles_policy_count;
  ELSE
    RAISE NOTICE 'Alle policies er opprettet på profiles tabellen';
  END IF;

  -- Sjekk companies policies
  SELECT COUNT(*) INTO v_companies_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'companies';
  
  IF v_companies_policy_count < 2 THEN
    RAISE WARNING 'Forventet 2 policies på companies, fant %', v_companies_policy_count;
  ELSE
    RAISE NOTICE 'Alle policies er opprettet på companies tabellen';
  END IF;
END $$;

-- ============================================================================
-- 6. TEST QUERY FOR Å VERIFISERE AT RLS FUNGERER
-- ============================================================================
-- Dette er en test-query som kan kjøres manuelt for å verifisere at RLS fungerer
-- Kommenter ut hvis du vil teste:
/*
-- Test som en autentisert bruker:
SELECT 
  p.*,
  c.name as company_name,
  c.logo_url
FROM public.profiles p
LEFT JOIN public.companies c ON p.company_id = c.id
WHERE p.id = auth.uid();
*/

-- ============================================================================
-- FERDIG: RLS-policies er nå riktig satt opp
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Test at innlogging fungerer
-- 2. Verifiser at brukere kan se sin egen profil
-- 3. Sjekk at companies JOIN fungerer i profil-query
-- ============================================================================

