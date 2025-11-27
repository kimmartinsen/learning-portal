-- ============================================================================
-- FIX: Create missing user assignments for existing department assignments
-- ============================================================================
-- Dette skriptet finner alle avdelingstildelinger som mangler brukertildelinger
-- og oppretter dem automatisk.
-- ============================================================================

-- ============================================================================
-- 1. FINN ALLE AVDELINGSTILDELINGER SOM MANGLER BRUKERTILDELINGER
-- ============================================================================

-- Vis hvilke avdelingstildelinger som mangler brukertildelinger
SELECT 
  pa.id as dept_assignment_id,
  pa.program_id,
  tp.title as program_title,
  pa.assigned_to_department_id,
  d.name as department_name,
  (SELECT COUNT(*) FROM public.user_departments WHERE department_id = pa.assigned_to_department_id) as users_in_dept,
  (SELECT COUNT(*) 
   FROM public.program_assignments pa2 
   WHERE pa2.program_id = pa.program_id 
     AND pa2.assigned_to_user_id IN (
       SELECT user_id FROM public.user_departments WHERE department_id = pa.assigned_to_department_id
     )
  ) as existing_user_assignments
FROM public.program_assignments pa
JOIN public.training_programs tp ON pa.program_id = tp.id
JOIN public.departments d ON pa.assigned_to_department_id = d.id
WHERE pa.assigned_to_department_id IS NOT NULL
ORDER BY pa.created_at DESC;

-- ============================================================================
-- 2. OPPRETT MANGLENDE BRUKERTILDELINGER FOR EKSISTERENDE AVDELINGSTILDELINGER
-- ============================================================================

DO $$
DECLARE
  v_dept_assignment RECORD;
  v_user_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_existing_user_assignment UUID;
  v_created_count INTEGER := 0;
BEGIN
  -- Gå gjennom alle avdelingstildelinger
  FOR v_dept_assignment IN 
    SELECT 
      pa.id,
      pa.program_id,
      pa.assigned_to_department_id,
      pa.assigned_by,
      pa.due_date,
      pa.notes,
      tp.deadline_days
    FROM public.program_assignments pa
    JOIN public.training_programs tp ON pa.program_id = tp.id
    WHERE pa.assigned_to_department_id IS NOT NULL
  LOOP
    -- Hent deadline_days fra programmet eller bruk standard
    v_deadline_days := COALESCE(v_dept_assignment.deadline_days, 14);
    v_due_date := COALESCE(v_dept_assignment.due_date, NOW() + (v_deadline_days || ' days')::INTERVAL);
    
    -- Gå gjennom alle brukere i avdelingen
    FOR v_user_record IN 
      SELECT user_id 
      FROM public.user_departments 
      WHERE department_id = v_dept_assignment.assigned_to_department_id
    LOOP
      -- Sjekk om brukeren allerede har dette kurset
      SELECT id INTO v_existing_user_assignment
      FROM public.program_assignments
      WHERE program_id = v_dept_assignment.program_id
        AND assigned_to_user_id = v_user_record.user_id
      LIMIT 1;

      -- Kun opprett ny tildeling hvis brukeren ikke allerede har kurset
      IF v_existing_user_assignment IS NULL THEN
        BEGIN
          INSERT INTO public.program_assignments (
            program_id, 
            assigned_to_user_id, 
            assigned_by, 
            due_date, 
            notes,
            is_auto_assigned,
            status
          ) VALUES (
            v_dept_assignment.program_id, 
            v_user_record.user_id, 
            v_dept_assignment.assigned_by, 
            v_due_date, 
            COALESCE(v_dept_assignment.notes, 'Automatisk tildelt via avdeling'),
            true,
            'assigned'
          )
          ON CONFLICT (program_id, assigned_to_user_id) DO NOTHING;
          
          GET DIAGNOSTICS v_created_count = ROW_COUNT;
          IF v_created_count > 0 THEN
            v_created_count := v_created_count + 1;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- Log feil, men fortsett med neste bruker
          RAISE WARNING 'Kunne ikke opprette tildeling for bruker % i program %: %', 
            v_user_record.user_id, v_dept_assignment.program_id, SQLERRM;
        END;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Opprettet % brukertildelinger for eksisterende avdelingstildelinger', v_created_count;
END $$;

-- ============================================================================
-- 3. VERIFISER AT BRUKERTILDELINGER ER OPPRETTET
-- ============================================================================

-- Sjekk resultatet
SELECT 
  pa.id as dept_assignment_id,
  tp.title as program_title,
  d.name as department_name,
  (SELECT COUNT(*) FROM public.user_departments WHERE department_id = pa.assigned_to_department_id) as users_in_dept,
  (SELECT COUNT(*) 
   FROM public.program_assignments pa2 
   WHERE pa2.program_id = pa.program_id 
     AND pa2.assigned_to_user_id IN (
       SELECT user_id FROM public.user_departments WHERE department_id = pa.assigned_to_department_id
     )
     AND pa2.is_auto_assigned = true
  ) as user_assignments_created
FROM public.program_assignments pa
JOIN public.training_programs tp ON pa.program_id = tp.id
JOIN public.departments d ON pa.assigned_to_department_id = d.id
WHERE pa.assigned_to_department_id IS NOT NULL
ORDER BY pa.created_at DESC;

-- ============================================================================
-- FERDIG: Eksisterende avdelingstildelinger har nå brukertildelinger
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Alle eksisterende avdelingstildelinger har nå brukertildelinger
-- 2. Brukere vil nå se kursene sine på "Min opplæring"
-- 3. Fremtidige tildelinger vil automatisk opprette brukertildelinger via funksjonen
-- ============================================================================

