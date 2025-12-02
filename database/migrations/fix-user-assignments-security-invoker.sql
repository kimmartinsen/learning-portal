-- ============================================================================
-- FIX: Remove SECURITY DEFINER from user_assignments view
-- ============================================================================
-- Problem: user_assignments view har SECURITY DEFINER som omgår RLS
-- Løsning: Gjenskape viewet med SECURITY INVOKER (standard, men eksplisitt)
-- ============================================================================

-- Drop eksisterende view for å fjerne SECURITY DEFINER
DROP VIEW IF EXISTS public.user_assignments CASCADE;

-- Gjenskape view med SECURITY INVOKER
-- Dette sikrer at RLS fra underliggende tabeller respekteres
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
  
  -- Calculated status - Respekter locked og pending
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

-- ============================================================================
-- Verifisering: Sjekk at security_invoker er satt
-- ============================================================================
-- Kjør denne for å verifisere:
-- SELECT 
--   c.relname as view_name,
--   c.reloptions
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' 
-- AND c.relname = 'user_assignments';
-- 
-- reloptions skal inneholde {security_invoker=true}
-- ============================================================================

