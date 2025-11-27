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
-- 2. FJERN ALLE EKSISTERENDE POLICIES FØRST (før vi dropper funksjoner)
-- ============================================================================

-- Drop policies først fordi de avhenger av funksjonene
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users view own company" ON public.companies;
DROP POLICY IF EXISTS "Admins update company" ON public.companies;

-- ============================================================================
-- 3. OPPRETT HELPER FUNKSJONER FOR Å UNNGÅ REKURSJON
-- ============================================================================

-- Drop eksisterende funksjoner hvis de finnes (nå kan vi droppe dem siden policies er borte)
DROP FUNCTION IF EXISTS public.get_user_company_id(UUID);
DROP FUNCTION IF EXISTS public.is_user_admin_for_company(UUID, UUID);

-- Opprett en SECURITY DEFINER funksjon som kan lese profiles uten RLS
-- Dette unngår infinite recursion i policies
CREATE OR REPLACE FUNCTION public.get_user_company_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN v_company_id;
END;
$$;

-- Opprett funksjon for å sjekke admin-status
CREATE OR REPLACE FUNCTION public.is_user_admin_for_company(p_user_id UUID, p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_is_admin BOOLEAN := false;
BEGIN
  SELECT (role = 'admin' AND company_id = p_company_id) INTO v_is_admin
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- ============================================================================
-- 4. OPPRETT POLICIES UTEN REKURSJON
-- ============================================================================

-- Policy 1: Users view own profile (MÅ være først, ingen avhengigheter)
-- Dette er den viktigste policyen - den må alltid fungere
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- Policy 2: Users view company profiles
-- Bruker SECURITY DEFINER funksjon for å unngå rekursjon
CREATE POLICY "Users view company profiles" ON public.profiles FOR SELECT 
  USING (
    company_id = public.get_user_company_id(auth.uid())
  );

-- Policy 3: Admins manage profiles (INSERT, UPDATE, DELETE)
-- Bruker SECURITY DEFINER funksjon for å unngå rekursjon
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL 
  USING (
    public.is_user_admin_for_company(auth.uid(), company_id)
  );

-- ============================================================================
-- 5. SIKRE AT COMPANIES RLS ER RIKTIG SATT OPP
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policies er allerede droppet i steg 2, så vi trenger bare å opprette dem

-- Users view own company (bruker funksjon for å unngå rekursjon)
CREATE POLICY "Users view own company" ON public.companies FOR SELECT 
  USING (
    id = public.get_user_company_id(auth.uid())
  );

-- Admins update company (bruker funksjon for å unngå rekursjon)
CREATE POLICY "Admins update company" ON public.companies FOR UPDATE 
  USING (
    public.is_user_admin_for_company(auth.uid(), id)
  );

-- ============================================================================
-- 6. VERIFISER AT POLICIES ER OPPRETTET
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
-- 7. TEST QUERY FOR Å VERIFISERE AT RLS FUNGERER
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
-- FERDIG: RLS-policies er nå riktig satt opp uten rekursjon
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Test at innlogging fungerer
-- 2. Verifiser at brukere kan se sin egen profil
-- 3. Sjekk at companies JOIN fungerer i profil-query
-- 4. Ingen infinite recursion-feil skal oppstå
-- ============================================================================

