-- ============================================================================
-- FIX: Mutable Search Path in update_topics_updated_at function
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path
-- Løsning: Legge til SET search_path = ''
-- ============================================================================

-- Drop eksisterende trigger og funksjon
DROP TRIGGER IF EXISTS topics_updated_at ON public.topics;
DROP FUNCTION IF EXISTS public.update_topics_updated_at() CASCADE;

-- Gjenskape funksjonen med SET search_path = ''
CREATE FUNCTION public.update_topics_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Gjenskape trigger
CREATE TRIGGER topics_updated_at
    BEFORE UPDATE ON public.topics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_topics_updated_at();

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

