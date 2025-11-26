-- ============================================================================
-- OPPDATER EKSISTERENDE ASSIGNMENTS TIL LOCKED STATUS
-- ============================================================================
-- Denne scripten oppdaterer eksisterende program_assignments til 'locked'
-- status hvis de ikke oppfyller sine forutsetninger
-- ============================================================================

-- Oppdater assignments til 'locked' for kurs med prerequisite_type = 'previous_auto' eller 'previous_manual'
-- hvor forrige kurs i sekvensen ikke er fullført
UPDATE program_assignments pa
SET status = 'locked'
FROM training_programs tp
WHERE pa.program_id = tp.id
  AND tp.prerequisite_type IN ('previous_auto', 'previous_manual')
  AND pa.status NOT IN ('completed', 'locked')
  AND NOT EXISTS (
    -- Sjekk om forrige kurs er fullført
    SELECT 1
    FROM training_programs prev_tp
    JOIN program_assignments prev_pa ON prev_pa.program_id = prev_tp.id
    WHERE prev_tp.theme_id = tp.theme_id
      AND prev_tp.sort_order < tp.sort_order
      AND prev_pa.assigned_to_user_id = pa.assigned_to_user_id
      AND prev_pa.status = 'completed'
      AND prev_tp.sort_order = (
        -- Finn den umiddelbart forrige kurset
        SELECT MAX(sort_order)
        FROM training_programs
        WHERE theme_id = tp.theme_id
          AND sort_order < tp.sort_order
      )
  );

-- Oppdater assignments til 'locked' for kurs med prerequisite_type = 'specific_courses'
-- hvor ikke alle spesifiserte kurs er fullført
UPDATE program_assignments pa
SET status = 'locked'
FROM training_programs tp
WHERE pa.program_id = tp.id
  AND tp.prerequisite_type = 'specific_courses'
  AND pa.status NOT IN ('completed', 'locked')
  AND EXISTS (
    -- Sjekk om det finnes forutsetnings-kurs som ikke er fullført
    SELECT 1
    FROM UNNEST(tp.prerequisite_course_ids) AS prereq_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM program_assignments prereq_pa
      WHERE prereq_pa.program_id = prereq_id
        AND prereq_pa.assigned_to_user_id = pa.assigned_to_user_id
        AND prereq_pa.status = 'completed'
    )
  );

-- ============================================================================
-- RESULTAT
-- ============================================================================
-- Nå vil alle assignments som ikke oppfyller sine forutsetninger
-- ha status 'locked' i stedet for 'assigned'
-- ============================================================================

-- VERIFISER RESULTATET:
-- Kjør denne spørringen for å se alle låste kurs:
/*
SELECT 
  pa.id,
  tp.title as kurs_navn,
  tp.sort_order,
  tp.prerequisite_type,
  pa.status,
  p.full_name as bruker,
  t.name as program
FROM program_assignments pa
JOIN training_programs tp ON pa.program_id = tp.id
JOIN profiles p ON pa.assigned_to_user_id = p.id
LEFT JOIN themes t ON tp.theme_id = t.id
WHERE pa.status = 'locked'
ORDER BY t.name, tp.sort_order;
*/

