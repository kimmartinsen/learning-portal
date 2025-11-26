-- ============================================================================
-- VERIFISER AT MIGRASJONEN ER KJØRT
-- ============================================================================
-- Kjør disse spørringene for å sjekke om alle nødvendige kolonner eksisterer
-- ============================================================================

-- 1. SJEKK OM THEMES-TABELLEN EKSISTERER
SELECT EXISTS (
  SELECT FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'themes'
) as themes_table_exists;

-- 2. SJEKK OM PREREQUISITE KOLONNER EKSISTERER I TRAINING_PROGRAMS
SELECT 
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'training_programs' 
    AND column_name = 'prerequisite_type'
  ) as prerequisite_type_exists,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'training_programs' 
    AND column_name = 'prerequisite_course_ids'
  ) as prerequisite_course_ids_exists,
  EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'training_programs' 
    AND column_name = 'sort_order'
  ) as sort_order_exists;

-- 3. VIS KURSINFORMASJON MED PREREQUISITER
SELECT 
  tp.id,
  tp.title as kurs_navn,
  tp.sort_order,
  tp.prerequisite_type,
  tp.prerequisite_course_ids,
  t.name as program_navn
FROM training_programs tp
LEFT JOIN themes t ON tp.theme_id = t.id
ORDER BY t.name, tp.sort_order;

-- 4. VIS ALLE ASSIGNMENTS MED STATUS
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
ORDER BY p.full_name, t.name, tp.sort_order;

-- ============================================================================
-- FORVENTET RESULTAT:
-- ============================================================================
-- 1. themes_table_exists: true
-- 2. Alle *_exists kolonner: true
-- 3. Du skal se dine kurs med sort_order og prerequisite_type
-- 4. Du skal se assignments med status (noen skal være 'locked')
-- ============================================================================

