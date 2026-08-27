-- EduInSight — Row Level Security policies and table privileges
-- Migration: 003_rls_policies.sql
--
-- This file configures RLS policies and table-level GRANTs.
-- RLS controls which ROWS each role can access on base tables.
-- Column-level filtering is handled by views/RPCs in 002_views.sql.
--
-- Table privileges are configured as follows:
--   - All privileges revoked from anon and authenticated on every app table
--   - Reference tables receive SELECT for authenticated (for dropdowns)
--   - All other data access goes through views or SECURITY DEFINER RPCs
--
-- Role summary:
--   student  — own profile, own feedback (via submit_feedback RPC),
--              own enrolments, published updates (via view), reference data
--   teacher  — own profile, own assignments, teacher-safe views/RPCs,
--              NO direct base-table access to feedback/clusters/actions
--   admin    — management access to non-sensitive data on base tables;
--              sensitive feedback through sensitive_feedback_for_admin()
--
-- Security validation tests live in supabase/tests/database_security.sql
-- (not in production migrations).

-- ============================================================================
-- 1. ENABLE RLS ON ALL APPLICATION TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_tag_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. TABLE PRIVILEGES
-- ============================================================================
-- Revoke everything from anon and authenticated, then grant back the minimum.
-- Teachers access data through views/RPCs (which run as owner, bypassing RLS
-- and table-level grants).  Students use submit_feedback RPC instead of
-- direct INSERT.  No anon access to any application data.

-- Revoke from anon on ALL application tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.departments FROM anon;
REVOKE ALL ON public.courses FROM anon;
REVOKE ALL ON public.course_sections FROM anon;
REVOKE ALL ON public.teacher_assignments FROM anon;
REVOKE ALL ON public.course_enrolments FROM anon;
REVOKE ALL ON public.feedback FROM anon;
REVOKE ALL ON public.extracted_issues FROM anon;
REVOKE ALL ON public.issue_clusters FROM anon;
REVOKE ALL ON public.cluster_feedback FROM anon;
REVOKE ALL ON public.cluster_tag_synonyms FROM anon;
REVOKE ALL ON public.actions FROM anon;
REVOKE ALL ON public.action_updates FROM anon;

-- Revoke from authenticated on ALL application tables
REVOKE ALL ON public.profiles FROM authenticated;
REVOKE ALL ON public.departments FROM authenticated;
REVOKE ALL ON public.courses FROM authenticated;
REVOKE ALL ON public.course_sections FROM authenticated;
REVOKE ALL ON public.teacher_assignments FROM authenticated;
REVOKE ALL ON public.course_enrolments FROM authenticated;
REVOKE ALL ON public.feedback FROM authenticated;
REVOKE ALL ON public.extracted_issues FROM authenticated;
REVOKE ALL ON public.issue_clusters FROM authenticated;
REVOKE ALL ON public.cluster_feedback FROM authenticated;
REVOKE ALL ON public.cluster_tag_synonyms FROM authenticated;
REVOKE ALL ON public.actions FROM authenticated;
REVOKE ALL ON public.action_updates FROM authenticated;

-- Grant back minimum required table-level privileges for authenticated.
-- Reference tables: SELECT for dropdowns (RLS policies restrict rows).
GRANT SELECT ON public.departments TO authenticated;
GRANT SELECT ON public.courses TO authenticated;
GRANT SELECT ON public.course_sections TO authenticated;
GRANT SELECT ON public.cluster_tag_synonyms TO authenticated;

-- Profiles: SELECT needed for own-profile and admin user management RLS.
GRANT SELECT ON public.profiles TO authenticated;

-- Teacher assignments: SELECT needed for own-assignment RLS policy.
GRANT SELECT ON public.teacher_assignments TO authenticated;

-- Course enrolments: SELECT needed for own-enrolment RLS policy.
GRANT SELECT ON public.course_enrolments TO authenticated;

-- Feedback: SELECT needed for own-feedback RLS policy.
-- No INSERT grant: students submit through submit_feedback RPC only.
GRANT SELECT ON public.feedback TO authenticated;

-- All other tables (extracted_issues, issue_clusters, cluster_feedback,
-- actions, action_updates): NO table-level grants for authenticated.
-- Teachers access via views/RPCs; students access via published_action_updates
-- view; admins access via RLS policies (which require the SELECT grant below).
GRANT SELECT ON public.extracted_issues TO authenticated;
GRANT SELECT ON public.issue_clusters TO authenticated;
GRANT SELECT ON public.cluster_feedback TO authenticated;
GRANT SELECT ON public.actions TO authenticated;
GRANT SELECT ON public.action_updates TO authenticated;

-- Admin UPDATE grants (needed for admin RLS UPDATE policies to take effect).
GRANT UPDATE ON public.profiles TO authenticated;
GRANT UPDATE ON public.feedback TO authenticated;

-- Admin write grants for reference and management tables.
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.course_sections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT INSERT, DELETE ON public.course_enrolments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.extracted_issues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.issue_clusters TO authenticated;
GRANT INSERT, DELETE ON public.cluster_feedback TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cluster_tag_synonyms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.actions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.action_updates TO authenticated;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- --------------------------------------------------------------------------
-- PROFILES
-- --------------------------------------------------------------------------

CREATE POLICY profiles_read_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY profiles_admin_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- DEPARTMENTS (reference data: read by all; managed by admin)
-- --------------------------------------------------------------------------

CREATE POLICY departments_read_all ON public.departments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY departments_admin_write ON public.departments
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- COURSES (reference data: read by all; managed by admin)
-- --------------------------------------------------------------------------

CREATE POLICY courses_read_all ON public.courses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY courses_admin_write ON public.courses
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- COURSE SECTIONS (reference data: read by all; managed by admin)
-- --------------------------------------------------------------------------

CREATE POLICY course_sections_read_all ON public.course_sections
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY course_sections_admin_write ON public.course_sections
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- TEACHER ASSIGNMENTS
-- --------------------------------------------------------------------------

CREATE POLICY teacher_assignments_read_own ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'teacher' AND teacher_id = auth.uid()
  );

CREATE POLICY teacher_assignments_admin_read ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY teacher_assignments_admin_write ON public.teacher_assignments
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- COURSE ENROLMENTS
-- --------------------------------------------------------------------------

CREATE POLICY course_enrolments_student_read ON public.course_enrolments
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'student' AND student_id = auth.uid()
  );

CREATE POLICY course_enrolments_admin_read ON public.course_enrolments
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY course_enrolments_admin_insert ON public.course_enrolments
  FOR INSERT TO authenticated
  WITH CHECK (private.get_user_role() = 'admin');

CREATE POLICY course_enrolments_admin_delete ON public.course_enrolments
  FOR DELETE TO authenticated
  USING (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- FEEDBACK
-- --------------------------------------------------------------------------
-- Students: read own feedback only.  INSERT via submit_feedback RPC (no
-- direct INSERT policy).  No UPDATE policy (protected fields locked).
-- Teachers: no policy (access via feedback_for_teacher view only).
-- Admins: read/update non-sensitive feedback only.

CREATE POLICY feedback_student_read ON public.feedback
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'student' AND student_id = auth.uid()
  );

CREATE POLICY feedback_admin_read ON public.feedback
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin' AND is_sensitive = false);

CREATE POLICY feedback_admin_update ON public.feedback
  FOR UPDATE TO authenticated
  USING (private.get_user_role() = 'admin' AND is_sensitive = false);

-- --------------------------------------------------------------------------
-- EXTRACTED ISSUES
-- --------------------------------------------------------------------------
-- Teachers: no policy (access via extracted_issues_for_teacher view only).

CREATE POLICY extracted_issues_admin_read ON public.extracted_issues
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY extracted_issues_admin_write ON public.extracted_issues
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- ISSUE CLUSTERS
-- --------------------------------------------------------------------------
-- Teachers: no policy (access via clusters_for_teacher view only).

CREATE POLICY clusters_admin_read ON public.issue_clusters
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY clusters_admin_write ON public.issue_clusters
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- CLUSTER FEEDBACK (junction table)
-- --------------------------------------------------------------------------

CREATE POLICY cluster_feedback_admin_read ON public.cluster_feedback
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY cluster_feedback_admin_write ON public.cluster_feedback
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- CLUSTER TAG SYNONYMS (reference data: read by all; managed by admin)
-- --------------------------------------------------------------------------

CREATE POLICY cluster_tag_synonyms_read ON public.cluster_tag_synonyms
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cluster_tag_synonyms_admin_write ON public.cluster_tag_synonyms
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- ACTIONS
-- --------------------------------------------------------------------------
-- Teachers: no policy (access via teacher RPCs only).

CREATE POLICY actions_admin_read ON public.actions
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY actions_admin_write ON public.actions
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- --------------------------------------------------------------------------
-- ACTION UPDATES
-- --------------------------------------------------------------------------
-- Students: no policy (access via published_action_updates view only).
-- Teachers: no policy (access via teacher RPCs only).

CREATE POLICY action_updates_admin_read ON public.action_updates
  FOR SELECT TO authenticated
  USING (private.get_user_role() = 'admin');

CREATE POLICY action_updates_admin_write ON public.action_updates
  FOR ALL TO authenticated
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- Security validation tests moved to supabase/tests/database_security.sql
