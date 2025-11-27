-- ============================================================================
-- TEST: assign_program_to_department function
-- ============================================================================
-- Dette skriptet tester om funksjonen faktisk fungerer
-- ============================================================================

-- 1. Finn et eksisterende program og en avdeling for å teste med
SELECT 
  tp.id as program_id,
  tp.title as program_title,
  tp.deadline_days,
  d.id as department_id,
  d.name as department_name,
  (SELECT COUNT(*) FROM public.user_departments WHERE department_id = d.id) as users_in_dept,
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1) as admin_id
FROM public.training_programs tp
CROSS JOIN public.departments d
WHERE tp.company_id = (SELECT company_id FROM public.profiles WHERE role = 'admin' LIMIT 1)
LIMIT 1;

-- 2. Test funksjonen manuelt (erstatt med faktiske ID-er fra spørring 1)
-- IKKE KJØR DENNE DELEN UTEN Å ERSTATTE ID-ENE!
/*
DO $$
DECLARE
  v_result UUID;
  v_program_id UUID := 'PROGRAM_ID_FRA_SPORRING_1';
  v_department_id UUID := 'DEPARTMENT_ID_FRA_SPORRING_1';
  v_admin_id UUID := 'ADMIN_ID_FRA_SPORRING_1';
BEGIN
  -- Prøv å kjøre funksjonen
  v_result := assign_program_to_department(
    v_program_id,
    v_department_id,
    v_admin_id,
    'Test tildeling fra SQL'
  );
  
  RAISE NOTICE 'Funksjonen fullført! Assignment ID: %', v_result;
  
  -- Sjekk om brukertildelinger ble opprettet
  RAISE NOTICE 'Antall brukertildelinger opprettet: %', (
    SELECT COUNT(*) 
    FROM public.program_assignments 
    WHERE program_id = v_program_id 
      AND assigned_to_user_id IS NOT NULL
      AND is_auto_assigned = true
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Funksjonen feilet: %', SQLERRM;
END $$;
*/

