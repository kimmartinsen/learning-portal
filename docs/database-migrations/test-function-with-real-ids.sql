-- ============================================================================
-- TEST: assign_program_to_department med faktiske ID-er
-- ============================================================================
-- Dette skriptet tester funksjonen med faktiske ID-er fra databasen
-- ============================================================================

-- Bruk ID-ene fra forrige spørring:
-- program_id: a7f3aff0-ef8a-488c-9bc0-3a0596614e87
-- department_id: e5fc4e92-0845-4095-8691-282be2647019
-- admin_id: 7b1076b8-89fe-454c-b7d9-016b6912e6e1

DO $$
DECLARE
  v_result UUID;
  v_program_id UUID := 'a7f3aff0-ef8a-488c-9bc0-3a0596614e87';
  v_department_id UUID := 'e5fc4e92-0845-4095-8691-282be2647019';
  v_admin_id UUID := '7b1076b8-89fe-454c-b7d9-016b6912e6e1';
  v_user_count INTEGER;
  v_assignment_count INTEGER;
BEGIN
  -- Sjekk antall brukere i avdelingen først
  SELECT COUNT(*) INTO v_user_count
  FROM public.user_departments 
  WHERE department_id = v_department_id;
  
  RAISE NOTICE 'Antall brukere i avdelingen: %', v_user_count;
  
  -- Sjekk om det allerede finnes en avdelingstildeling
  SELECT COUNT(*) INTO v_assignment_count
  FROM public.program_assignments
  WHERE program_id = v_program_id
    AND assigned_to_department_id = v_department_id;
  
  RAISE NOTICE 'Eksisterende avdelingstildelinger: %', v_assignment_count;
  
  -- Prøv å kjøre funksjonen
  BEGIN
    v_result := assign_program_to_department(
      v_program_id,
      v_department_id,
      v_admin_id,
      'Test tildeling fra SQL'
    );
    
    RAISE NOTICE 'Funksjonen fullført! Assignment ID: %', v_result;
    
    -- Sjekk om brukertildelinger ble opprettet
    SELECT COUNT(*) INTO v_assignment_count
    FROM public.program_assignments 
    WHERE program_id = v_program_id 
      AND assigned_to_user_id IS NOT NULL
      AND is_auto_assigned = true;
    
    RAISE NOTICE 'Antall brukertildelinger opprettet: %', v_assignment_count;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Funksjonen feilet: %', SQLERRM;
    RAISE WARNING 'SQLSTATE: %', SQLSTATE;
  END;
END $$;

-- Sjekk resultatet
SELECT 
  pa.id,
  pa.program_id,
  tp.title as program_title,
  pa.assigned_to_department_id,
  d.name as department_name,
  pa.assigned_to_user_id,
  p.full_name as user_name,
  pa.is_auto_assigned,
  pa.status,
  pa.created_at
FROM public.program_assignments pa
LEFT JOIN public.training_programs tp ON pa.program_id = tp.id
LEFT JOIN public.departments d ON pa.assigned_to_department_id = d.id
LEFT JOIN public.profiles p ON pa.assigned_to_user_id = p.id
WHERE pa.program_id = 'a7f3aff0-ef8a-488c-9bc0-3a0596614e87'
  AND (
    pa.assigned_to_department_id = 'e5fc4e92-0845-4095-8691-282be2647019'
    OR pa.assigned_to_user_id IN (
      SELECT user_id FROM public.user_departments 
      WHERE department_id = 'e5fc4e92-0845-4095-8691-282be2647019'
    )
  )
ORDER BY pa.created_at DESC;

