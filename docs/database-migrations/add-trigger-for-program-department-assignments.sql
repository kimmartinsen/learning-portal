-- ============================================================================
-- ADD: Trigger for Program Department Assignments
-- ============================================================================
-- Dette skriptet legger til en trigger som automatisk oppretter brukertildelinger
-- når en avdeling tildeles et kurs, tilsvarende som for checklists.
-- ============================================================================

-- ============================================================================
-- 1. FUNKSJON FOR Å HÅNDTERE AVDELINGSTILDELINGER
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_program_department_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_existing_user_assignment UUID;
BEGIN
  -- Kun hvis dette er en avdelingstildeling
  IF NEW.assigned_to_department_id IS NOT NULL THEN
    -- Hent deadline_days fra programmet
    SELECT deadline_days INTO v_deadline_days 
    FROM public.training_programs 
    WHERE id = NEW.program_id;
    
    v_due_date := COALESCE(NEW.due_date, NOW() + (COALESCE(v_deadline_days, 14) || ' days')::INTERVAL);
    
    -- Opprett individuelle brukertildelinger for alle brukere i avdelingen
    FOR v_user_record IN 
      SELECT user_id FROM public.user_departments WHERE department_id = NEW.assigned_to_department_id
    LOOP
      -- Sjekk om brukeren allerede har dette kurset
      SELECT id INTO v_existing_user_assignment
      FROM public.program_assignments
      WHERE program_id = NEW.program_id
        AND assigned_to_user_id = v_user_record.user_id
      LIMIT 1;

      -- Kun opprett ny tildeling hvis brukeren ikke allerede har kurset
      IF v_existing_user_assignment IS NULL THEN
        INSERT INTO public.program_assignments (
          program_id, 
          assigned_to_user_id, 
          assigned_by, 
          due_date, 
          notes,
          is_auto_assigned,
          status
        ) VALUES (
          NEW.program_id, 
          v_user_record.user_id, 
          NEW.assigned_by, 
          v_due_date, 
          COALESCE(NEW.notes, 'Automatisk tildelt via avdeling'),
          true,
          COALESCE(NEW.status, 'assigned')
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. TRIGGER FOR Å HÅNDTERE AVDELINGSTILDELINGER
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_handle_program_department_assignment ON public.program_assignments;

CREATE TRIGGER trigger_handle_program_department_assignment
  AFTER INSERT ON public.program_assignments
  FOR EACH ROW
  WHEN (NEW.assigned_to_department_id IS NOT NULL)
  EXECUTE FUNCTION handle_program_department_assignment();

-- ============================================================================
-- FERDIG: Trigger er nå opprettet
-- ============================================================================
-- 
-- Etter å ha kjørt dette skriptet:
-- 1. Når en avdeling tildeles et kurs, opprettes automatisk brukertildelinger
-- 2. Dette skjer automatisk, uavhengig av om funksjonen feiler eller ikke
-- 3. Brukere vil nå se kursene sine på "Min opplæring"
-- ============================================================================

