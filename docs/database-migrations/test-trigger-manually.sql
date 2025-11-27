-- ============================================================================
-- TEST: Manually test the trigger
-- ============================================================================
-- Dette skriptet tester om triggeren faktisk kjører ved å manuelt opprette
-- en avdelingstildeling og se om brukertildelinger blir opprettet
-- ============================================================================

-- Først, finn en eksisterende avdeling og et kurs for å teste med
-- (Erstatt med faktiske ID-er fra din database)

-- 1. Finn et kurs og en avdeling
SELECT 
  tp.id as program_id,
  tp.title as program_title,
  d.id as department_id,
  d.name as department_name,
  (SELECT COUNT(*) FROM public.user_departments WHERE department_id = d.id) as users_in_dept
FROM public.training_programs tp
CROSS JOIN public.departments d
WHERE tp.company_id = (SELECT company_id FROM public.profiles WHERE role = 'admin' LIMIT 1)
LIMIT 1;

-- 2. Test: Opprett en avdelingstildeling manuelt
-- (Kopier resultatene fra spørring 1 og bruk dem her)
/*
INSERT INTO public.program_assignments (
  program_id,
  assigned_to_department_id,
  assigned_by,
  due_date,
  notes,
  status
) VALUES (
  'PROGRAM_ID_FRA_SPORRING_1',  -- Erstatt med faktisk program_id
  'DEPARTMENT_ID_FRA_SPORRING_1',  -- Erstatt med faktisk department_id
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1),
  NOW() + INTERVAL '14 days',
  'Test tildeling',
  'assigned'
);
*/

-- 3. Sjekk om brukertildelinger ble opprettet
-- (Kjør etter å ha kjørt INSERT i steg 2)
/*
SELECT 
  pa.id,
  pa.program_id,
  tp.title as program_title,
  pa.assigned_to_user_id,
  p.full_name as user_name,
  pa.is_auto_assigned,
  pa.status,
  pa.created_at
FROM public.program_assignments pa
LEFT JOIN public.training_programs tp ON pa.program_id = tp.id
LEFT JOIN public.profiles p ON pa.assigned_to_user_id = p.id
WHERE pa.program_id = 'PROGRAM_ID_FRA_SPORRING_1'  -- Erstatt med faktisk program_id
  AND pa.is_auto_assigned = true
ORDER BY pa.created_at DESC;
*/

