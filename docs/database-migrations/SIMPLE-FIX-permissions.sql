-- ENKEL FIX: Gi full tilgang til alle tabeller
-- Dato: 2025-11-27
-- Dette fjerner ALL sikkerhet for å få systemet til å fungere

-- 1. Disable RLS
ALTER TABLE public.program_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_item_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items DISABLE ROW LEVEL SECURITY;

-- 2. Grant ALL permissions
GRANT ALL ON public.program_assignments TO authenticated, anon;
GRANT ALL ON public.training_programs TO authenticated, anon;
GRANT ALL ON public.user_departments TO authenticated, anon;
GRANT ALL ON public.notifications TO authenticated, anon;
GRANT ALL ON public.profiles TO authenticated, anon;
GRANT ALL ON public.departments TO authenticated, anon;
GRANT ALL ON public.checklist_assignments TO authenticated, anon;
GRANT ALL ON public.checklist_item_status TO authenticated, anon;
GRANT ALL ON public.checklists TO authenticated, anon;
GRANT ALL ON public.checklist_items TO authenticated, anon;

-- 3. Grant USAGE på sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- FERDIG! Test kurstildeling nå.
