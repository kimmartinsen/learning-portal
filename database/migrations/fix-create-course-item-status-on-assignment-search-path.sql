-- ============================================================================
-- FIX: Mutable Search Path in create_course_item_status_on_assignment
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path
-- Løsning: Legge til SET search_path = '' og bruke public. prefix
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_course_item_status_on_assignment() CASCADE;

CREATE FUNCTION public.create_course_item_status_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_course_type VARCHAR(50);
  v_items RECORD;
BEGIN
  -- Sjekk om dette er et fysisk kurs
  SELECT course_type INTO v_course_type
  FROM public.training_programs
  WHERE id = NEW.program_id;
  
  -- Kun håndter fysiske kurs
  IF v_course_type != 'physical-course' THEN
    RETURN NEW;
  END IF;
  
  -- Opprett item_status for alle items i kurset
  FOR v_items IN 
    SELECT id FROM public.course_items 
    WHERE program_id = NEW.program_id
    ORDER BY order_index
  LOOP
    INSERT INTO public.course_item_status (assignment_id, item_id, status)
    VALUES (NEW.id, v_items.id, 'not_started')
    ON CONFLICT (assignment_id, item_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Gjenskape trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'program_assignments' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS create_course_item_status_trigger ON public.program_assignments;
    CREATE TRIGGER create_course_item_status_trigger
      AFTER INSERT ON public.program_assignments
      FOR EACH ROW
      EXECUTE FUNCTION public.create_course_item_status_on_assignment();
  END IF;
END $$;

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

