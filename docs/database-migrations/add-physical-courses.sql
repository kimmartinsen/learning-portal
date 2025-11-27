-- ============================================================================
-- LEGG TIL STØTTE FOR FYSISKE KURS
-- ============================================================================
-- Fysiske kurs fungerer som ett enkelt sjekkpunkt som kan bekrefte at kurset er gjennomført
-- Instruktører og admin kan bekrefte at fysiske kurs er gjennomført
-- ============================================================================

-- 1. LEGG TIL course_type I training_programs
ALTER TABLE training_programs
ADD COLUMN IF NOT EXISTS course_type VARCHAR(50) DEFAULT 'e-course' 
  CHECK (course_type IN ('e-course', 'physical-course'));

COMMENT ON COLUMN training_programs.course_type IS 
  'Type kurs: e-course (nettbasert med moduler) eller physical-course (fysisk kurs som sjekkpunkt)';

-- 2. INDEKSER
CREATE INDEX IF NOT EXISTS idx_training_programs_course_type ON training_programs(course_type);

-- 3. OPPDATER RLS POLICIES FOR program_assignments
-- La instruktører oppdatere status for fysiske kurs de er instruktør for

-- Fjern policy hvis den allerede eksisterer
DROP POLICY IF EXISTS "Instructors can update physical course assignments" ON program_assignments;

-- Opprett policy som lar instruktører oppdatere status for fysiske kurs
CREATE POLICY "Instructors can update physical course assignments" ON program_assignments
  FOR UPDATE
  USING (
    -- Sjekk om dette er et fysisk kurs
    EXISTS (
      SELECT 1 FROM training_programs tp
      WHERE tp.id = program_assignments.program_id
      AND tp.course_type = 'physical-course'
      AND tp.instructor_id = auth.uid()
      AND tp.company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'instructor'
      )
    )
  )
  WITH CHECK (
    -- Samme sjekk for WITH CHECK
    EXISTS (
      SELECT 1 FROM training_programs tp
      WHERE tp.id = program_assignments.program_id
      AND tp.course_type = 'physical-course'
      AND tp.instructor_id = auth.uid()
      AND tp.company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'instructor'
      )
    )
  );

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå har du:
-- 1. course_type i training_programs (e-course eller physical-course)
-- 2. Fysiske kurs fungerer som ett enkelt sjekkpunkt - ingen separate items
-- 3. Instruktører kan oppdatere status på program_assignments for fysiske kurs de er instruktør for
-- 4. Admin kan allerede oppdatere status (via eksisterende policies)
-- ============================================================================

