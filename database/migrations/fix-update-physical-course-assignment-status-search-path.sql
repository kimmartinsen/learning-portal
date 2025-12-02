-- ============================================================================
-- FIX: Mutable Search Path in update_physical_course_assignment_status
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path
-- Løsning: Legge til SET search_path = '' og bruke public. prefix
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_physical_course_assignment_status() CASCADE;

CREATE FUNCTION public.update_physical_course_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_assignment_id UUID;
  v_program_id UUID;
  v_course_type VARCHAR(50);
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_total_items INTEGER;
  v_completed_items INTEGER;
BEGIN
  v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  -- Hent program_id fra item
  SELECT ci.program_id INTO v_program_id
  FROM public.course_items ci
  WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
  
  -- Sjekk om dette er et fysisk kurs
  SELECT course_type INTO v_course_type
  FROM public.training_programs
  WHERE id = v_program_id;
  
  -- Kun håndter fysiske kurs
  IF v_course_type != 'physical-course' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Sjekk status på alle items for denne assignment
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) = COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) > 0 AND COUNT(*) FILTER (WHERE status = 'in_progress') > 0
  INTO v_total_items, v_completed_items, v_all_completed, v_any_in_progress
  FROM public.course_item_status
  WHERE assignment_id = v_assignment_id;
  
  -- Oppdater assignment status
  IF v_all_completed AND v_total_items > 0 THEN
    UPDATE public.program_assignments
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_assignment_id AND status != 'completed';
  ELSIF v_any_in_progress THEN
    UPDATE public.program_assignments
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_assignment_id AND status NOT IN ('in_progress', 'completed');
  ELSIF v_completed_items = 0 THEN
    UPDATE public.program_assignments
    SET status = 'assigned', completed_at = NULL, updated_at = NOW()
    WHERE id = v_assignment_id AND status = 'completed';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Gjenskape trigger (hvis den eksisterer)
-- Sjekk hvilken tabell triggeren er på og opprett på nytt
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'course_item_status' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS update_physical_course_status_trigger ON public.course_item_status;
    CREATE TRIGGER update_physical_course_status_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.course_item_status
      FOR EACH ROW
      EXECUTE FUNCTION public.update_physical_course_assignment_status();
  END IF;
END $$;

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

