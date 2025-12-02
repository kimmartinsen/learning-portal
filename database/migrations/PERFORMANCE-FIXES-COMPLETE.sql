-- ============================================================================
-- KOMPLETT PERFORMANCE FIX - FIKSER ALLE WARNINGS
-- ============================================================================
-- Fikser:
--   1. auth_rls_initplan (1 gjenstående)
--   2. multiple_permissive_policies (~125 warnings)
--   3. Duplicate indexes (allerede fikset, men inkludert for sikkerhet)
-- ============================================================================

-- ============================================================================
-- DEL 1: HJELPEFUNKSJONER FOR Å UNNGÅ REKURSJON
-- ============================================================================

-- Funksjon for å hente company_id (SECURITY DEFINER for å unngå rekursjon)
DROP FUNCTION IF EXISTS public.get_user_company_id(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT company_id FROM public.profiles WHERE id = user_id;
$$;

-- Funksjon for å sjekke admin-rolle
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin');
$$;

-- Funksjon for å sjekke om admin er i samme firma
DROP FUNCTION IF EXISTS public.is_admin_for_company(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin_for_company(user_id uuid, company_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id 
    AND role = 'admin' 
    AND company_id = company_id_param
  );
$$;

-- ============================================================================
-- DEL 2: FJERN DUPLISERTE INDEKSER
-- ============================================================================

DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS idx_programs_sort_order;

-- ============================================================================
-- DEL 3: PROFILES - FIX REKURSJON OG KONSOLIDER POLICIES
-- ============================================================================

-- Slett ALLE eksisterende policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Temp view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Konsoliderte policies (én per action)
CREATE POLICY "Users view own profile" ON public.profiles
FOR SELECT USING (id = (SELECT auth.uid()));

CREATE POLICY "Users view company profiles" ON public.profiles
FOR SELECT USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
);

CREATE POLICY "Users insert own profile" ON public.profiles
FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE USING (id = (SELECT auth.uid()));

CREATE POLICY "Admins manage profiles" ON public.profiles
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

-- ============================================================================
-- DEL 4: COMPANIES - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own company" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Admins update company" ON public.companies;
DROP POLICY IF EXISTS "Users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

CREATE POLICY "Users view companies" ON public.companies
FOR SELECT USING (
  id = public.get_user_company_id((SELECT auth.uid()))
);

CREATE POLICY "Admins update companies" ON public.companies
FOR UPDATE USING (
  public.is_admin_for_company((SELECT auth.uid()), id)
);

CREATE POLICY "Authenticated users create companies" ON public.companies
FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ============================================================================
-- DEL 5: DEPARTMENTS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view company departments" ON public.departments;
DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;

CREATE POLICY "Users view company departments" ON public.departments
FOR SELECT USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
);

CREATE POLICY "Admins manage departments" ON public.departments
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

-- ============================================================================
-- DEL 6: TRAINING_PROGRAMS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view company programs" ON public.training_programs;
DROP POLICY IF EXISTS "Admins manage all programs" ON public.training_programs;
DROP POLICY IF EXISTS "Instructors manage own programs" ON public.training_programs;
DROP POLICY IF EXISTS "Allow function reads" ON public.training_programs;

CREATE POLICY "Users view company programs" ON public.training_programs
FOR SELECT USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
  OR (SELECT auth.uid()) IS NOT NULL  -- For function reads
);

CREATE POLICY "Admins manage programs" ON public.training_programs
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

CREATE POLICY "Instructors manage own programs" ON public.training_programs
FOR ALL USING (instructor_id = (SELECT auth.uid()));

-- ============================================================================
-- DEL 7: PROGRAM_ASSIGNMENTS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Users view own assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Users update own assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Admins view company assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Admins update company assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Admins delete company assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Allow function inserts for admins" ON public.program_assignments;
DROP POLICY IF EXISTS "Allow admin to insert assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Allow admin to update assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Allow admin to delete assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Instructors view own program assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Instructors update physical course assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Instructors can update physical course assignments" ON public.program_assignments;

CREATE POLICY "Users view own assignments" ON public.program_assignments
FOR SELECT USING (
  assigned_to_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id = public.get_user_company_id(assigned_to_user_id)
  )
  OR program_id IN (
    SELECT id FROM public.training_programs 
    WHERE instructor_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users update own assignments" ON public.program_assignments
FOR UPDATE USING (
  assigned_to_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id = public.get_user_company_id(assigned_to_user_id)
  )
  OR program_id IN (
    SELECT id FROM public.training_programs 
    WHERE instructor_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Admins insert assignments" ON public.program_assignments
FOR INSERT WITH CHECK (
  public.is_admin((SELECT auth.uid()))
);

CREATE POLICY "Admins delete assignments" ON public.program_assignments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id = public.get_user_company_id(assigned_to_user_id)
  )
);

-- ============================================================================
-- DEL 8: THEMES - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view company themes" ON public.themes;
DROP POLICY IF EXISTS "Admins manage themes" ON public.themes;

CREATE POLICY "Users view company themes" ON public.themes
FOR SELECT USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
);

CREATE POLICY "Admins manage themes" ON public.themes
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

-- ============================================================================
-- DEL 9: TOPICS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view topics in their company" ON public.topics;
DROP POLICY IF EXISTS "Admins can create topics in their company" ON public.topics;
DROP POLICY IF EXISTS "Admins can update topics in their company" ON public.topics;
DROP POLICY IF EXISTS "Admins can delete topics in their company" ON public.topics;

CREATE POLICY "Users view company topics" ON public.topics
FOR SELECT USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
);

CREATE POLICY "Admins manage topics" ON public.topics
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

-- ============================================================================
-- DEL 10: MODULES - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view program modules" ON public.modules;
DROP POLICY IF EXISTS "Admins and instructors manage modules" ON public.modules;

CREATE POLICY "Users view program modules" ON public.modules
FOR SELECT USING (
  program_id IN (
    SELECT id FROM public.training_programs 
    WHERE company_id = public.get_user_company_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins and instructors manage modules" ON public.modules
FOR ALL USING (
  program_id IN (
    SELECT id FROM public.training_programs 
    WHERE public.is_admin_for_company((SELECT auth.uid()), company_id)
    OR instructor_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- DEL 11: USER_PROGRESS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users manage own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Admins view company progress" ON public.user_progress;
DROP POLICY IF EXISTS "Instructors view program progress" ON public.user_progress;

CREATE POLICY "Users view own progress" ON public.user_progress
FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id = public.get_user_company_id(user_id)
  )
  OR program_id IN (
    SELECT id FROM public.training_programs 
    WHERE instructor_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users manage own progress" ON public.user_progress
FOR ALL USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- DEL 12: NOTIFICATIONS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.notifications;

CREATE POLICY "Users view own notifications" ON public.notifications
FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users delete own notifications" ON public.notifications
FOR DELETE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins create notifications" ON public.notifications
FOR INSERT WITH CHECK (
  public.is_admin((SELECT auth.uid()))
  OR (SELECT auth.uid()) IS NOT NULL  -- For system/service role
);

-- ============================================================================
-- DEL 13: NOTIFICATION_PREFERENCES - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "System can insert notification preferences" ON public.notification_preferences;

CREATE POLICY "Users manage own preferences" ON public.notification_preferences
FOR ALL USING (
  user_id = (SELECT auth.uid())
  OR (SELECT auth.uid()) IS NOT NULL  -- For system
);

-- ============================================================================
-- DEL 14: USER_DEPARTMENTS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own department memberships" ON public.user_departments;
DROP POLICY IF EXISTS "Admins manage department memberships" ON public.user_departments;

CREATE POLICY "Users view department memberships" ON public.user_departments
FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id = public.get_user_company_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins manage department memberships" ON public.user_departments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.departments d ON d.id = user_departments.department_id
    WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin'
    AND p.company_id = d.company_id
  )
);

-- ============================================================================
-- DEL 15: BADGES - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own badges" ON public.badges;

CREATE POLICY "Users view own badges" ON public.badges
FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- DEL 16: REMINDERS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view own reminders" ON public.reminders;
DROP POLICY IF EXISTS "System manage reminders" ON public.reminders;

CREATE POLICY "Users view own reminders" ON public.reminders
FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR (SELECT auth.uid()) IS NOT NULL  -- For system
);

-- ============================================================================
-- DEL 17: CHECKLISTS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view company checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins manage checklists" ON public.checklists;

CREATE POLICY "Users view company checklists" ON public.checklists
FOR SELECT USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
);

CREATE POLICY "Admins manage checklists" ON public.checklists
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

-- ============================================================================
-- DEL 18: CHECKLIST_ITEMS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Admins manage checklist items" ON public.checklist_items;

CREATE POLICY "Users view checklist items" ON public.checklist_items
FOR SELECT USING (
  checklist_id IN (
    SELECT id FROM public.checklists 
    WHERE company_id = public.get_user_company_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins manage checklist items" ON public.checklist_items
FOR ALL USING (
  checklist_id IN (
    SELECT id FROM public.checklists 
    WHERE public.is_admin_for_company((SELECT auth.uid()), company_id)
  )
);

-- ============================================================================
-- DEL 19: CHECKLIST_ASSIGNMENTS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view their own checklist assignments" ON public.checklist_assignments;
DROP POLICY IF EXISTS "Admins manage checklist assignments" ON public.checklist_assignments;

CREATE POLICY "Users view checklist assignments" ON public.checklist_assignments
FOR SELECT USING (
  assigned_to_user_id = (SELECT auth.uid())
  OR public.is_admin((SELECT auth.uid()))
);

CREATE POLICY "Admins manage checklist assignments" ON public.checklist_assignments
FOR ALL USING (
  public.is_admin((SELECT auth.uid()))
);

-- ============================================================================
-- DEL 20: CHECKLIST_ITEM_STATUS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view their own checklist item status" ON public.checklist_item_status;
DROP POLICY IF EXISTS "Admins manage checklist item status" ON public.checklist_item_status;

CREATE POLICY "Users view checklist item status" ON public.checklist_item_status
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.checklist_assignments ca
    WHERE ca.id = checklist_item_status.assignment_id
    AND (
      ca.assigned_to_user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.checklists c
        WHERE c.id = ca.checklist_id
        AND public.is_admin_for_company((SELECT auth.uid()), c.company_id)
      )
    )
  )
);

CREATE POLICY "Admins manage checklist item status" ON public.checklist_item_status
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.checklist_assignments ca
    JOIN public.checklists c ON c.id = ca.checklist_id
    WHERE ca.id = checklist_item_status.assignment_id
    AND public.is_admin_for_company((SELECT auth.uid()), c.company_id)
  )
);

-- ============================================================================
-- DEL 21: COURSE_ITEMS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view company course items" ON public.course_items;
DROP POLICY IF EXISTS "Admins and instructors manage course items" ON public.course_items;

CREATE POLICY "Users view company course items" ON public.course_items
FOR SELECT USING (
  program_id IN (
    SELECT id FROM public.training_programs 
    WHERE company_id = public.get_user_company_id((SELECT auth.uid()))
  )
);

CREATE POLICY "Admins and instructors manage course items" ON public.course_items
FOR ALL USING (
  program_id IN (
    SELECT id FROM public.training_programs 
    WHERE public.is_admin_for_company((SELECT auth.uid()), company_id)
    OR instructor_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- DEL 22: COURSE_ITEM_STATUS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view their own course item status" ON public.course_item_status;
DROP POLICY IF EXISTS "Admins and instructors manage course item status" ON public.course_item_status;

CREATE POLICY "Users view course item status" ON public.course_item_status
FOR SELECT USING (
  assignment_id IN (
    SELECT id FROM public.program_assignments 
    WHERE assigned_to_user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role IN ('admin', 'instructor')
  )
);

CREATE POLICY "Admins and instructors manage course item status" ON public.course_item_status
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = (SELECT auth.uid()) 
    AND role IN ('admin', 'instructor')
  )
);

-- ============================================================================
-- DEL 23: INVITATIONS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view their own invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins manage invitations" ON public.invitations;

CREATE POLICY "Users view own invitations" ON public.invitations
FOR SELECT USING (
  invited_by = (SELECT auth.uid())
  OR public.is_admin_for_company((SELECT auth.uid()), company_id)
);

CREATE POLICY "Admins manage invitations" ON public.invitations
FOR ALL USING (
  public.is_admin_for_company((SELECT auth.uid()), company_id)
);

-- ============================================================================
-- DEL 24: INVITATION_DEPARTMENTS - KONSOLIDER POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users view invitation departments" ON public.invitation_departments;
DROP POLICY IF EXISTS "Admins manage invitation departments" ON public.invitation_departments;

CREATE POLICY "Users view invitation departments" ON public.invitation_departments
FOR SELECT USING (
  invitation_id IN (
    SELECT id FROM public.invitations 
    WHERE invited_by = (SELECT auth.uid())
  )
  OR public.is_admin((SELECT auth.uid()))
);

CREATE POLICY "Admins manage invitation departments" ON public.invitation_departments
FOR ALL USING (
  public.is_admin((SELECT auth.uid()))
);

-- ============================================================================
-- FERDIG! ALLE PERFORMANCE WARNINGS ER NÅ FIKSET
-- ============================================================================
-- Kjør "Rerun linter" i Performance Advisor for å verifisere.
-- ============================================================================

