-- ============================================================================
-- FIX EKSISTERENDE CHECKLIST_ASSIGNMENTS - SETT is_auto_assigned KORREKT
-- ============================================================================
-- Dette oppdaterer eksisterende brukertildelinger til å ha is_auto_assigned = true
-- hvis brukeren er medlem av en avdeling som har tildelt sjekklisten
-- ============================================================================

-- Oppdater alle brukertildelinger hvor brukeren er medlem av en avdeling
-- som har tildelt sjekklisten, og sett is_auto_assigned = true
UPDATE checklist_assignments ca
SET is_auto_assigned = true
WHERE ca.assigned_to_user_id IS NOT NULL
  AND (ca.is_auto_assigned IS NULL OR ca.is_auto_assigned = false)
  AND EXISTS (
    -- Sjekk om brukeren er medlem av en avdeling som har tildelt denne sjekklisten
    SELECT 1
    FROM user_departments ud
    INNER JOIN checklist_assignments dept_ca 
      ON dept_ca.assigned_to_department_id = ud.department_id
      AND dept_ca.checklist_id = ca.checklist_id
    WHERE ud.user_id = ca.assigned_to_user_id
      AND dept_ca.assigned_to_department_id IS NOT NULL
  );

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Alle eksisterende brukertildelinger som burde være auto-assigned
-- har nå is_auto_assigned = true
-- ============================================================================
