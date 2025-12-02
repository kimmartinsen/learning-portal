-- ============================================================================
-- PERFORMANCE OPTIMALISERINGER - KJØR DETTE I SUPABASE SQL EDITOR
-- ============================================================================
-- Fikser følgende performance warnings:
--   1. Duplicate indexes (2 stk)
--   2. RLS Initplan - auth.uid() → (select auth.uid())
-- ============================================================================

-- ============================================================================
-- DEL 1: FJERN DUPLISERTE INDEKSER
-- ============================================================================

-- notifications: idx_notifications_user og idx_notifications_user_id er identiske
DROP INDEX IF EXISTS idx_notifications_user;
-- Beholder idx_notifications_user_id

-- training_programs: idx_programs_sort_order og idx_training_programs_theme_sort er identiske
DROP INDEX IF EXISTS idx_programs_sort_order;
-- Beholder idx_training_programs_theme_sort

-- ============================================================================
-- DEL 2: OPTIMALISER RLS POLICIES MED (SELECT auth.uid())
-- ============================================================================
-- Problemet: auth.uid() re-evalueres for hver rad
-- Løsning: Bytt til (select auth.uid()) som caches per query
-- ============================================================================

-- --------------------------------------------------------------------------
-- departments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view company departments" ON public.departments;
CREATE POLICY "Users view company departments" ON public.departments
FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
CREATE POLICY "Admins manage departments" ON public.departments
FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users view company profiles" ON public.profiles;
CREATE POLICY "Users view company profiles" ON public.profiles
FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles
FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- companies
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own company" ON public.companies;
CREATE POLICY "Users view own company" ON public.companies
FOR SELECT USING (
  id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins update company" ON public.companies;
CREATE POLICY "Admins update company" ON public.companies
FOR UPDATE USING (
  id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
CREATE POLICY "Users can view companies" ON public.companies
FOR SELECT USING (
  id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Users can update companies" ON public.companies;
CREATE POLICY "Users can update companies" ON public.companies
FOR UPDATE USING (
  id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies" ON public.companies
FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- --------------------------------------------------------------------------
-- training_programs
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view company programs" ON public.training_programs;
CREATE POLICY "Users view company programs" ON public.training_programs
FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage all programs" ON public.training_programs;
CREATE POLICY "Admins manage all programs" ON public.training_programs
FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Instructors manage own programs" ON public.training_programs;
CREATE POLICY "Instructors manage own programs" ON public.training_programs
FOR ALL USING (instructor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Allow function reads" ON public.training_programs;
CREATE POLICY "Allow function reads" ON public.training_programs
FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- --------------------------------------------------------------------------
-- program_assignments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.program_assignments;
CREATE POLICY "Users can view their own assignments" ON public.program_assignments
FOR SELECT USING (assigned_to_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users view own assignments" ON public.program_assignments;
CREATE POLICY "Users view own assignments" ON public.program_assignments
FOR SELECT USING (assigned_to_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users update own assignments" ON public.program_assignments;
CREATE POLICY "Users update own assignments" ON public.program_assignments
FOR UPDATE USING (assigned_to_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins view company assignments" ON public.program_assignments;
CREATE POLICY "Admins view company assignments" ON public.program_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id IN (
      SELECT company_id FROM profiles WHERE id = assigned_to_user_id
    )
  )
);

DROP POLICY IF EXISTS "Admins update company assignments" ON public.program_assignments;
CREATE POLICY "Admins update company assignments" ON public.program_assignments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id IN (
      SELECT company_id FROM profiles WHERE id = assigned_to_user_id
    )
  )
);

DROP POLICY IF EXISTS "Admins delete company assignments" ON public.program_assignments;
CREATE POLICY "Admins delete company assignments" ON public.program_assignments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id IN (
      SELECT company_id FROM profiles WHERE id = assigned_to_user_id
    )
  )
);

DROP POLICY IF EXISTS "Allow function inserts for admins" ON public.program_assignments;
CREATE POLICY "Allow function inserts for admins" ON public.program_assignments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Allow admin to insert assignments" ON public.program_assignments;
CREATE POLICY "Allow admin to insert assignments" ON public.program_assignments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Allow admin to update assignments" ON public.program_assignments;
CREATE POLICY "Allow admin to update assignments" ON public.program_assignments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Allow admin to delete assignments" ON public.program_assignments;
CREATE POLICY "Allow admin to delete assignments" ON public.program_assignments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Instructors view own program assignments" ON public.program_assignments;
CREATE POLICY "Instructors view own program assignments" ON public.program_assignments
FOR SELECT USING (
  program_id IN (SELECT id FROM training_programs WHERE instructor_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Instructors update physical course assignments" ON public.program_assignments;
CREATE POLICY "Instructors update physical course assignments" ON public.program_assignments
FOR UPDATE USING (
  program_id IN (SELECT id FROM training_programs WHERE instructor_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Instructors can update physical course assignments" ON public.program_assignments;
CREATE POLICY "Instructors can update physical course assignments" ON public.program_assignments
FOR UPDATE USING (
  program_id IN (SELECT id FROM training_programs WHERE instructor_id = (SELECT auth.uid()))
);

-- --------------------------------------------------------------------------
-- themes
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view company themes" ON public.themes;
CREATE POLICY "Users view company themes" ON public.themes
FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage themes" ON public.themes;
CREATE POLICY "Admins manage themes" ON public.themes
FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- topics
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view topics in their company" ON public.topics;
CREATE POLICY "Users can view topics in their company" ON public.topics
FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins can create topics in their company" ON public.topics;
CREATE POLICY "Admins can create topics in their company" ON public.topics
FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can update topics in their company" ON public.topics;
CREATE POLICY "Admins can update topics in their company" ON public.topics
FOR UPDATE USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can delete topics in their company" ON public.topics;
CREATE POLICY "Admins can delete topics in their company" ON public.topics
FOR DELETE USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- modules
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view program modules" ON public.modules;
CREATE POLICY "Users view program modules" ON public.modules
FOR SELECT USING (
  program_id IN (
    SELECT id FROM training_programs 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Admins and instructors manage modules" ON public.modules;
CREATE POLICY "Admins and instructors manage modules" ON public.modules
FOR ALL USING (
  program_id IN (
    SELECT id FROM training_programs 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR instructor_id = (SELECT auth.uid())
  )
);

-- --------------------------------------------------------------------------
-- user_progress
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own progress" ON public.user_progress;
CREATE POLICY "Users view own progress" ON public.user_progress
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users manage own progress" ON public.user_progress;
CREATE POLICY "Users manage own progress" ON public.user_progress
FOR ALL USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins view company progress" ON public.user_progress;
CREATE POLICY "Admins view company progress" ON public.user_progress
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id IN (SELECT company_id FROM profiles WHERE id = user_id)
  )
);

DROP POLICY IF EXISTS "Instructors view program progress" ON public.user_progress;
CREATE POLICY "Instructors view program progress" ON public.user_progress
FOR SELECT USING (
  program_id IN (SELECT id FROM training_programs WHERE instructor_id = (SELECT auth.uid()))
);

-- --------------------------------------------------------------------------
-- notifications
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
CREATE POLICY "Admins can create notifications" ON public.notifications
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- notification_preferences
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences
FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences
FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- --------------------------------------------------------------------------
-- user_departments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own department memberships" ON public.user_departments;
CREATE POLICY "Users view own department memberships" ON public.user_departments
FOR SELECT USING (
  user_id = (SELECT auth.uid()) 
  OR user_id IN (SELECT id FROM profiles WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Admins manage department memberships" ON public.user_departments;
CREATE POLICY "Admins manage department memberships" ON public.user_departments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN departments d ON d.id = user_departments.department_id
    WHERE p.id = (SELECT auth.uid()) 
    AND p.role = 'admin' 
    AND p.company_id = d.company_id
  )
);

-- --------------------------------------------------------------------------
-- badges
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own badges" ON public.badges;
CREATE POLICY "Users view own badges" ON public.badges
FOR SELECT USING (user_id = (SELECT auth.uid()));

-- --------------------------------------------------------------------------
-- reminders
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own reminders" ON public.reminders;
CREATE POLICY "Users view own reminders" ON public.reminders
FOR SELECT USING (user_id = (SELECT auth.uid()));

-- --------------------------------------------------------------------------
-- checklists
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view company checklists" ON public.checklists;
CREATE POLICY "Users view company checklists" ON public.checklists
FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage checklists" ON public.checklists;
CREATE POLICY "Admins manage checklists" ON public.checklists
FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- checklist_items
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view checklist items" ON public.checklist_items;
CREATE POLICY "Users view checklist items" ON public.checklist_items
FOR SELECT USING (
  checklist_id IN (
    SELECT id FROM checklists 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Admins manage checklist items" ON public.checklist_items;
CREATE POLICY "Admins manage checklist items" ON public.checklist_items
FOR ALL USING (
  checklist_id IN (
    SELECT id FROM checklists 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
);

-- --------------------------------------------------------------------------
-- checklist_assignments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view their own checklist assignments" ON public.checklist_assignments;
CREATE POLICY "Users view their own checklist assignments" ON public.checklist_assignments
FOR SELECT USING (assigned_to_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins manage checklist assignments" ON public.checklist_assignments;
CREATE POLICY "Admins manage checklist assignments" ON public.checklist_assignments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

-- --------------------------------------------------------------------------
-- checklist_item_status (bruker assignment_id, ikke user_id)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view their own checklist item status" ON public.checklist_item_status;
CREATE POLICY "Users view their own checklist item status" ON public.checklist_item_status
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM checklist_assignments ca
    WHERE ca.id = checklist_item_status.assignment_id
    AND (
      ca.assigned_to_user_id = (SELECT auth.uid()) OR
      EXISTS (
        SELECT 1 FROM checklists c
        WHERE c.id = ca.checklist_id
        AND c.company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
      )
    )
  )
);

DROP POLICY IF EXISTS "Admins manage checklist item status" ON public.checklist_item_status;
CREATE POLICY "Admins manage checklist item status" ON public.checklist_item_status
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM checklist_assignments ca
    JOIN checklists c ON c.id = ca.checklist_id
    WHERE ca.id = checklist_item_status.assignment_id
    AND c.company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
);

-- --------------------------------------------------------------------------
-- course_items
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view company course items" ON public.course_items;
CREATE POLICY "Users view company course items" ON public.course_items
FOR SELECT USING (
  program_id IN (
    SELECT id FROM training_programs 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Admins and instructors manage course items" ON public.course_items;
CREATE POLICY "Admins and instructors manage course items" ON public.course_items
FOR ALL USING (
  program_id IN (
    SELECT id FROM training_programs 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR instructor_id = (SELECT auth.uid())
  )
);

-- --------------------------------------------------------------------------
-- course_item_status
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view their own course item status" ON public.course_item_status;
CREATE POLICY "Users view their own course item status" ON public.course_item_status
FOR SELECT USING (
  assignment_id IN (SELECT id FROM program_assignments WHERE assigned_to_user_id = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins and instructors manage course item status" ON public.course_item_status;
CREATE POLICY "Admins and instructors manage course item status" ON public.course_item_status
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'instructor')
  )
);

-- --------------------------------------------------------------------------
-- invitations
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view their own invitations" ON public.invitations;
CREATE POLICY "Users view their own invitations" ON public.invitations
FOR SELECT USING (invited_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins manage invitations" ON public.invitations;
CREATE POLICY "Admins manage invitations" ON public.invitations
FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
);

-- --------------------------------------------------------------------------
-- invitation_departments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view invitation departments" ON public.invitation_departments;
CREATE POLICY "Users view invitation departments" ON public.invitation_departments
FOR SELECT USING (
  invitation_id IN (SELECT id FROM invitations WHERE invited_by = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Admins manage invitation departments" ON public.invitation_departments;
CREATE POLICY "Admins manage invitation departments" ON public.invitation_departments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

-- ============================================================================
-- FERDIG! Performance optimaliseringer er nå anvendt.
-- ============================================================================
-- Kjør "Rerun linter" i Performance Advisor for å verifisere.
-- ============================================================================

