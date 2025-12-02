-- ============================================================================
-- FIX: Mutable Search Path in create_invitation function
-- ============================================================================
-- Problem: Funksjonen har ikke en fast search_path
-- Løsning: Legge til SET search_path = '' og bruke public. prefix
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_invitation(uuid, character varying, character varying, character varying, uuid, uuid[]) CASCADE;

CREATE FUNCTION public.create_invitation(
  p_company_id uuid,
  p_email character varying,
  p_full_name character varying,
  p_role character varying,
  p_invited_by uuid,
  p_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation_id UUID;
  v_token VARCHAR;
  v_dept_id UUID;
BEGIN
  -- Generer unik token
  v_token := encode(gen_random_bytes(32), 'base64');
  
  -- Opprett invitasjon
  INSERT INTO public.invitations (
    company_id,
    email,
    full_name,
    role,
    invited_by,
    token,
    expires_at
  ) VALUES (
    p_company_id,
    p_email,
    p_full_name,
    p_role,
    p_invited_by,
    v_token,
    NOW() + INTERVAL '30 days' -- Invitasjon utløper om 30 dager
  ) RETURNING id INTO v_invitation_id;
  
  -- Legg til avdelinger
  IF array_length(p_department_ids, 1) > 0 THEN
    FOREACH v_dept_id IN ARRAY p_department_ids
    LOOP
      INSERT INTO public.invitation_departments (invitation_id, department_id)
      VALUES (v_invitation_id, v_dept_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN v_invitation_id;
END;
$$;

-- ============================================================================
-- FERDIG: Funksjonen har nå fast search_path for sikkerhet
-- ============================================================================
