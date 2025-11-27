-- ============================================================================
-- FIX: Complete RLS Fix for Login Flow (No Recursion)
-- ============================================================================
-- Dette skriptet sikrer at RLS-policies er riktig satt opp uten sirkulære
-- avhengigheter. Vi bruker en SECURITY DEFINER funksjon for å unngå
-- infinite recursion i policies.
-- ============================================================================

-- ============================================================================
-- 1. SIKRE AT RLS ER AKTIVERT PÅ PROFILES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. OPPRETT EN HELPER FUNKSJON FOR Å HENTE COMPANY_ID UTEN REKURSJON
-- ============================================================================

-- Drop eksisterende funksjon hvis den finnes
DROP FUNCTION IF EXISTS public.get_user_company_id(UUID);

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

-- ============================================================================
-- 3. FJERN ALLE EKSISTERENDE POLICIES FOR Å STARTE PÅ NYTT
-- ============================================================================

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

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
    EXISTS (
      SELECT 1 
      FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
      AND p.company_id = profiles.company_id
    )
  );

-- Men vent, policy 3 har fortsatt rekursjon. La oss fikse det:
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

-- Bruk funksjon for å sjekke admin-status også
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

CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL 
  USING (
    public.is_user_admin_for_company(auth.uid(), company_id)
  );

-- ============================================================================
-- 5. SIKRE AT COMPANIES RLS ER RIKTIG SATT OPP
-- ============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop eksisterende policies
DROP POLICY IF EXISTS "Users view own company" ON public.companies;
DROP POLICY IF EXISTS "Admins update company" ON public.companies;

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
-- FERDIG: RLS-policies er nå riktig satt opp uten rekursjon
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Test at innlogging fungerer
-- 2. Verifiser at brukere kan se sin egen profil
-- 3. Sjekk at companies JOIN fungerer i profil-query
-- 4. Ingen infinite recursion-feil skal oppstå
-- ============================================================================

