-- ============================================================================
-- FIX: RLS Security Issues from Supabase Security Advisor
-- ============================================================================
-- Dette skriptet fikser følgende sikkerhetsproblemer:
-- 1. RLS ikke aktivert på tabeller med policies (companies, departments, profiles, user_departments)
-- 2. Views med SECURITY DEFINER som kan omgå RLS
-- ============================================================================

-- ============================================================================
-- 1. AKTIVER RLS PÅ TABELLER SOM HAR POLICIES MEN IKKE RLS AKTIVERT
-- ============================================================================

-- Aktiver RLS på companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Aktiver RLS på departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Aktiver RLS på profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Aktiver RLS på user_departments
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. SJEKK OG OPPDATER RLS POLICIES FOR TABELLENE
-- ============================================================================

-- Companies policies (sjekk om de eksisterer, opprett hvis ikke)
DO $$
BEGIN
  -- Users view own company
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'companies' 
    AND policyname = 'Users view own company'
  ) THEN
    CREATE POLICY "Users view own company" ON public.companies FOR SELECT 
      USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
  END IF;

  -- Admins update company
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'companies' 
    AND policyname = 'Admins update company'
  ) THEN
    CREATE POLICY "Admins update company" ON public.companies FOR UPDATE 
      USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Departments policies
DO $$
BEGIN
  -- Users view company departments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'departments' 
    AND policyname = 'Users view company departments'
  ) THEN
    CREATE POLICY "Users view company departments" ON public.departments FOR SELECT 
      USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
  END IF;

  -- Admins manage departments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'departments' 
    AND policyname = 'Admins manage departments'
  ) THEN
    CREATE POLICY "Admins manage departments" ON public.departments FOR ALL 
      USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- Profiles policies
DO $$
BEGIN
  -- Users view own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users view own profile'
  ) THEN
    CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT 
      USING (auth.uid() = id);
  END IF;

  -- Users view company profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users view company profiles'
  ) THEN
    CREATE POLICY "Users view company profiles" ON public.profiles FOR SELECT 
      USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
  END IF;

  -- Admins manage profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Admins manage profiles'
  ) THEN
    CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL 
      USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- User departments policies
DO $$
BEGIN
  -- Users view their own department memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_departments' 
    AND policyname = 'Users view own department memberships'
  ) THEN
    CREATE POLICY "Users view own department memberships" ON public.user_departments FOR SELECT 
      USING (user_id = auth.uid() OR user_id IN (SELECT id FROM profiles WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));
  END IF;

  -- Admins manage department memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_departments' 
    AND policyname = 'Admins manage department memberships'
  ) THEN
    CREATE POLICY "Admins manage department memberships" ON public.user_departments FOR ALL 
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          JOIN departments d ON d.id = user_departments.department_id
          WHERE p.id = auth.uid() 
          AND p.role = 'admin' 
          AND p.company_id = d.company_id
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 3. FJERN SECURITY DEFINER FRA VIEWS (hvis de har det)
-- ============================================================================

-- Drop existing views first to avoid column name conflicts and remove SECURITY DEFINER
DROP VIEW IF EXISTS public.user_assignments CASCADE;
DROP VIEW IF EXISTS public.department_assignments CASCADE;

-- Recreate user_assignments view without SECURITY DEFINER
-- Views arver RLS fra underliggende tabeller, så SECURITY DEFINER er ikke nødvendig
-- Eksplisitt opprett som SECURITY INVOKER (standard, men eksplisitt for sikkerhet)
CREATE VIEW public.user_assignments
WITH (security_invoker = true) AS
SELECT 
  pa.id,
  pa.program_id,
  pa.assigned_to_user_id as user_id,
  pa.due_date,
  pa.status,
  pa.completed_at,
  pa.notes,
  pa.is_auto_assigned,
  pa.assigned_at,
  
  -- Program info
  tp.title as program_title,
  tp.description as program_description,
  tp.deadline_days,
  
  -- Theme info
  t.name as theme_name,
  
  -- Days remaining calculation
  CASE 
    WHEN pa.status IN ('completed', 'locked', 'pending') THEN 0
    WHEN pa.due_date < NOW() THEN 0
    ELSE EXTRACT(EPOCH FROM (pa.due_date - NOW())) / 86400 
  END::INTEGER as days_remaining,
  
  -- Calculated status
  CASE 
    WHEN pa.status = 'locked' THEN 'locked'
    WHEN pa.status = 'pending' THEN 'pending'
    WHEN pa.status = 'completed' THEN 'completed'
    WHEN pa.due_date < NOW() AND pa.status != 'completed' THEN 'overdue'
    WHEN pa.status = 'started' THEN 'in_progress'
    ELSE 'not_started'
  END as calculated_status,
  
  -- Progress from user_progress table
  COALESCE(
    (SELECT COUNT(*)::FLOAT FROM user_progress up 
     WHERE up.program_id = tp.id 
     AND up.user_id = pa.assigned_to_user_id 
     AND up.status = 'completed') / NULLIF(
       (SELECT COUNT(*) FROM modules WHERE program_id = tp.id), 0
     ) * 100, 0
  )::INTEGER as progress_percentage,
  
  -- Total modules and completed count
  (SELECT COUNT(*) FROM modules WHERE program_id = tp.id) as total_modules,
  (SELECT COUNT(*) FROM user_progress up 
   WHERE up.program_id = tp.id 
   AND up.user_id = pa.assigned_to_user_id 
   AND up.status = 'completed') as completed_modules
  
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
LEFT JOIN themes t ON tp.theme_id = t.id
WHERE pa.assigned_to_user_id IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.user_assignments TO authenticated;

-- Recreate department_assignments view without SECURITY DEFINER
-- Eksplisitt opprett som SECURITY INVOKER (standard, men eksplisitt for sikkerhet)
CREATE VIEW public.department_assignments
WITH (security_invoker = true) AS
    SELECT 
      pa.id,
      pa.program_id,
      pa.assigned_to_department_id as department_id,
      pa.assigned_by,
      pa.assigned_at,
      pa.notes,
      
      -- Program info
      tp.title as program_title,
      tp.description as program_description,
      tp.deadline_days,
      
      -- Theme info
      t.name as theme_name,
      
      -- Department info
      d.name as department_name,
      d.description as department_description
      
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
LEFT JOIN themes t ON tp.theme_id = t.id
LEFT JOIN departments d ON pa.assigned_to_department_id = d.id
WHERE pa.assigned_to_department_id IS NOT NULL;

-- Grant access to authenticated users
GRANT SELECT ON public.department_assignments TO authenticated;

-- ============================================================================
-- 4. VERIFISER AT RLS ER AKTIVERT
-- ============================================================================

-- Verifiser at RLS er aktivert på alle tabeller
DO $$
DECLARE
  v_table_name TEXT;
  v_rls_enabled BOOLEAN;
BEGIN
  FOR v_table_name IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('companies', 'departments', 'profiles', 'user_departments')
  LOOP
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_table_name;
    
    IF NOT v_rls_enabled THEN
      RAISE WARNING 'RLS er ikke aktivert på tabellen: %', v_table_name;
    ELSE
      RAISE NOTICE 'RLS er aktivert på tabellen: %', v_table_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FERDIG: Alle sikkerhetsproblemer skal nå være fikset
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Sjekk Security Advisor i Supabase igjen
-- 2. Verifiser at alle RLS-problemer er løst
-- 3. Test at applikasjonen fungerer som forventet
-- ============================================================================

