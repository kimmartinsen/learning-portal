-- ============================================================================
-- RYDD OPP I DUPLIKATE TILDELINGER
-- ============================================================================
-- Dette scriptet fjerner duplikate program_assignments slik at hver bruker
-- kun har én tildeling per kurs.
-- ============================================================================

-- Vis duplikater først (for å se hva som blir slettet)
SELECT 
  assigned_to_user_id,
  program_id,
  COUNT(*) as antall,
  array_agg(id) as assignment_ids
FROM public.program_assignments
WHERE assigned_to_user_id IS NOT NULL
GROUP BY assigned_to_user_id, program_id
HAVING COUNT(*) > 1;

-- Slett duplikater (behold den eldste tildelingen)
DELETE FROM public.program_assignments
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY assigned_to_user_id, program_id 
        ORDER BY assigned_at ASC, created_at ASC
      ) as rn
    FROM public.program_assignments
    WHERE assigned_to_user_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Verifiser at det ikke er flere duplikater
SELECT 
  assigned_to_user_id,
  program_id,
  COUNT(*) as antall
FROM public.program_assignments
WHERE assigned_to_user_id IS NOT NULL
GROUP BY assigned_to_user_id, program_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- FERDIG! Duplikater er nå fjernet.
-- ============================================================================

