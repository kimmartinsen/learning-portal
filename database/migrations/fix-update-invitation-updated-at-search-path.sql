-- ============================================================================
-- FIX: Mutable Search Path in update_invitation_updated_at function
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path
-- Løsning: Legge til SET search_path = ''
-- 
-- MERK: Denne funksjonen eksisterer i Supabase men ikke i kodebasen.
-- Den er trolig en standard updated_at trigger for en invitations-tabell.
-- ============================================================================

-- Drop eksisterende funksjon
DROP FUNCTION IF EXISTS public.update_invitation_updated_at() CASCADE;

-- Gjenskape funksjonen med SET search_path = ''
CREATE FUNCTION public.update_invitation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Gjenskape trigger (hvis invitations-tabellen eksisterer)
-- Hvis tabellen heter noe annet, endre "invitations" til riktig navn
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS update_invitation_updated_at_trigger ON public.invitations;
        CREATE TRIGGER update_invitation_updated_at_trigger
            BEFORE UPDATE ON public.invitations
            FOR EACH ROW
            EXECUTE FUNCTION public.update_invitation_updated_at();
    END IF;
END $$;

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================

