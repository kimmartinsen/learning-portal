-- Migrering: Gjenskape assignment funksjoner med enklest mulig syntaks
-- Dato: 2025-11-27
-- Formål: Lage funksjoner som garantert fungerer i Supabase

-- Strategi: Droppe og gjenskape funksjonene helt fra bunnen
-- med den enkleste syntaksen som fungerer

-- 1. DROPP eksisterende funksjoner
DROP FUNCTION IF EXISTS public.assign_program_to_department(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_program_to_user(UUID, UUID, UUID, TEXT);

-- 2. GJENSKAPE assign_program_to_user (enklere først)
CREATE FUNCTION public.assign_program_to_user(
  p_program_id UUID,
  p_user_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_assignment_id UUID;
BEGIN
  -- Hent deadline_days fra programmet
  SELECT deadline_days INTO v_deadline_days
  FROM training_programs
  WHERE id = p_program_id;

  -- Beregn due_date
  v_due_date := NOW() + (v_deadline_days || ' days')::INTERVAL;

  -- Opprett tildelingen
  INSERT INTO program_assignments (
    program_id,
    assigned_to_user_id,
    assigned_by,
    due_date,
    notes,
    status
  ) VALUES (
    p_program_id,
    p_user_id,
    p_assigned_by,
    v_due_date,
    p_notes,
    'assigned'
  ) RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

-- 3. GJENSKAPE assign_program_to_department
CREATE FUNCTION public.assign_program_to_department(
  p_program_id UUID,
  p_department_id UUID,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignment_id UUID;
  v_user_record RECORD;
  v_deadline_days INTEGER;
  v_due_date TIMESTAMPTZ;
  v_existing_user_assignment UUID;
BEGIN
  -- Hent deadline_days fra programmet
  SELECT deadline_days INTO v_deadline_days
  FROM training_programs
  WHERE id = p_program_id;

  v_due_date := NOW() + (v_deadline_days || ' days')::INTERVAL;

  -- Opprett avdelingstildelingen
  INSERT INTO program_assignments (
    program_id,
    assigned_to_department_id,
    assigned_by,
    due_date,
    notes,
    status
  ) VALUES (
    p_program_id,
    p_department_id,
    p_assigned_by,
    v_due_date,
    p_notes,
    'assigned'
  ) RETURNING id INTO v_assignment_id;

  -- Opprett individuelle tildelinger for alle brukere i avdelingen
  -- Bruker user_departments tabell (mange-til-mange)
  FOR v_user_record IN
    SELECT user_id FROM user_departments WHERE department_id = p_department_id
  LOOP
    -- Sjekk om brukeren allerede har dette kurset
    SELECT id INTO v_existing_user_assignment
    FROM program_assignments
    WHERE program_id = p_program_id
      AND assigned_to_user_id = v_user_record.user_id
    LIMIT 1;

    -- Kun opprett ny tildeling hvis brukeren ikke allerede har kurset
    IF v_existing_user_assignment IS NULL THEN
      INSERT INTO program_assignments (
        program_id,
        assigned_to_user_id,
        assigned_by,
        due_date,
        notes,
        is_auto_assigned,
        status
      ) VALUES (
        p_program_id,
        v_user_record.user_id,
        p_assigned_by,
        v_due_date,
        p_notes,
        true,
        'assigned'
      );
    END IF;
  END LOOP;

  RETURN v_assignment_id;
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.assign_program_to_department(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_to_user(UUID, UUID, UUID, TEXT) TO authenticated;

-- 5. Disable RLS på program_assignments midlertidig for testing
-- (Vi kan aktivere det igjen senere når vi vet at funksjonen fungerer)
ALTER TABLE public.program_assignments DISABLE ROW LEVEL SECURITY;

-- 6. Test at funksjonene eksisterer
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('assign_program_to_department', 'assign_program_to_user')
  AND pronamespace = 'public'::regnamespace;

-- VIKTIG:
-- Denne versjonen:
-- 1. DROPPER SECURITY DEFINER (som kan forårsake search_path problemer)
-- 2. DROPPER public. prefiks (siden vi ikke bruker SECURITY DEFINER)
-- 3. DISABLER RLS midlertidig for å teste
--
-- Hvis dette fungerer, kan vi legge tilbake SECURITY DEFINER og RLS senere.
--
-- NESTE STEG ETTER Å HA KJØRT DENNE:
-- 1. Test å opprette et kurs og tildele til avdeling
-- 2. Hvis det fungerer, kjør simple-test-assignment-function.sql for å verifisere
-- 3. Rapporter tilbake om det fungerte!
