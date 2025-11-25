-- Migrering: Omdøping av Tema til Program og sekvensiell kurs-styring
-- Dato: 2025-11-25
-- Formål: Støtte sekvensiell gjennomføring av kurs i et program (tidligere tema)

-- 1. OPPDATER THEMES (Nå konseptuelt "Program")
-- Legger til styring av progresjonstype
ALTER TABLE themes 
ADD COLUMN IF NOT EXISTS progression_type VARCHAR(50) DEFAULT 'flexible' 
CHECK (progression_type IN ('flexible', 'sequential_auto', 'sequential_manual'));

-- Forklaring av typer:
-- 'flexible': Alle kurs er tilgjengelige med en gang (dagens oppførsel)
-- 'sequential_auto': Neste kurs låses opp automatisk når forrige er bestått
-- 'sequential_manual': Neste kurs må låses opp manuelt av admin etter at forrige er bestått

-- 2. OPPDATER TRAINING_PROGRAMS (Nå konseptuelt "Kurs")
-- Legger til rekkefølge for kurs i et program
ALTER TABLE training_programs
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Oppdater eksisterende sort_order basert på opprettelsesdato (fallback)
WITH ordered_programs AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY theme_id ORDER BY created_at) as rn
  FROM training_programs
  WHERE theme_id IS NOT NULL
)
UPDATE training_programs
SET sort_order = ordered_programs.rn
FROM ordered_programs
WHERE training_programs.id = ordered_programs.id;

-- 3. OPPDATER PROGRAM_ASSIGNMENTS
-- Vi må utvide sjekken for status for å tillate 'locked' og 'pending'
-- Siden vi ikke enkelt kan endre en CHECK constraint i PostgreSQL uten å droppe den først:

ALTER TABLE program_assignments
DROP CONSTRAINT IF EXISTS program_assignments_status_check;

ALTER TABLE program_assignments
ADD CONSTRAINT program_assignments_status_check 
CHECK (status IN ('assigned', 'started', 'completed', 'overdue', 'cancelled', 'locked', 'pending'));

-- 4. INDEKSER
CREATE INDEX IF NOT EXISTS idx_programs_sort_order ON training_programs(theme_id, sort_order);

-- 5. FUNKSJONER FOR SEKVENS
-- Funksjon for å finne neste kurs i rekken
CREATE OR REPLACE FUNCTION get_next_course_in_program(p_theme_id UUID, p_current_sort_order INTEGER)
RETURNS UUID AS $$
DECLARE
  v_next_program_id UUID;
BEGIN
  SELECT id INTO v_next_program_id
  FROM training_programs
  WHERE theme_id = p_theme_id
    AND sort_order > p_current_sort_order
  ORDER BY sort_order ASC
  LIMIT 1;
  
  RETURN v_next_program_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatisk opplåsing (hvis sequential_auto)
-- Denne må kalles når en assignment settes til 'completed'
CREATE OR REPLACE FUNCTION handle_course_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_theme_id UUID;
  v_progression_type VARCHAR;
  v_current_sort_order INTEGER;
  v_next_program_id UUID;
  v_next_assignment_id UUID;
  v_user_id UUID;
BEGIN
  -- Kun kjør hvis status endres til 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    
    -- 1. Finn tema-info og nåværende sort_order
    SELECT tp.theme_id, tp.sort_order, t.progression_type
    INTO v_theme_id, v_current_sort_order, v_progression_type
    FROM training_programs tp
    JOIN themes t ON tp.theme_id = t.id
    WHERE tp.id = NEW.program_id;

    -- Hvis temaet har sekvensiell progresjon
    IF v_progression_type IN ('sequential_auto', 'sequential_manual') THEN
      
      -- 2. Finn neste kurs
      SELECT id INTO v_next_program_id
      FROM training_programs
      WHERE theme_id = v_theme_id
        AND sort_order > v_current_sort_order
      ORDER BY sort_order ASC
      LIMIT 1;

      -- Hvis det finnes et neste kurs
      IF v_next_program_id IS NOT NULL THEN
        
        v_user_id := NEW.assigned_to_user_id;
        
        -- Sjekk om brukeren allerede har assignment for neste kurs
        -- (Det burde eksistere som 'locked' eller 'pending' hvis det er del av en pakke, 
        --  eller vi må opprette det nå hvis det ikke finnes)
        
        -- I denne logikken antar vi at Assignments allerede er opprettet (f.eks. ved påmelding til Tema),
        -- men satt til 'locked'. Hvis de ikke finnes, bør vi kanskje opprette dem?
        -- For enkelhets skyld sjekker vi om det finnes en assignment.
        
        SELECT id INTO v_next_assignment_id
        FROM program_assignments
        WHERE program_id = v_next_program_id
          AND assigned_to_user_id = v_user_id;

        IF v_next_assignment_id IS NOT NULL THEN
          -- Hvis assignment finnes
          IF v_progression_type = 'sequential_auto' THEN
            -- Lås opp automatisk
            UPDATE program_assignments
            SET status = 'assigned', assigned_at = NOW()
            WHERE id = v_next_assignment_id AND status IN ('locked', 'pending');
          ELSIF v_progression_type = 'sequential_manual' THEN
            -- Sett til pending (venter på admin) hvis den var locked
            UPDATE program_assignments
            SET status = 'pending'
            WHERE id = v_next_assignment_id AND status = 'locked';
          END IF;
        ELSE
          -- Assignment finnes ikke. Skal vi opprette den?
          -- Hvis 'sequential_auto', ja.
          IF v_progression_type = 'sequential_auto' THEN
             INSERT INTO program_assignments (
               program_id, assigned_to_user_id, assigned_by, due_date, status
             ) VALUES (
               v_next_program_id, 
               v_user_id, 
               NEW.assigned_by, -- Arv assigned_by fra forrige?
               NOW() + INTERVAL '14 days', -- Default frist
               'assigned'
             );
          ELSIF v_progression_type = 'sequential_manual' THEN
             -- Opprett som 'pending' eller 'locked'? 
             -- Kanskje 'pending' så admin ser den i køen?
             INSERT INTO program_assignments (
               program_id, assigned_to_user_id, assigned_by, due_date, status
             ) VALUES (
               v_next_program_id, 
               v_user_id, 
               NEW.assigned_by,
               NOW() + INTERVAL '14 days',
               'pending' -- Venter på godkjenning
             );
          END IF;
        END IF;
        
      END IF; -- End if next program exists
    END IF; -- End if sequential
  END IF; -- End if completed

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Koble triggeren
DROP TRIGGER IF EXISTS trigger_course_completion_sequence ON program_assignments;
CREATE TRIGGER trigger_course_completion_sequence
  AFTER UPDATE OF status ON program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_course_completion();

