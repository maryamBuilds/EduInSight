-- EduInSight — Row Level Security policies
-- Migration: 003_rls_policies.sql
--
-- RLS controls which ROWS each role can access on base tables.
-- Column-level filtering (e.g. hiding student_id from teachers) is
-- handled by the views and functions in 002_views.sql, NOT by RLS.
--
-- Role summary:
--   student     — own profile, own feedback (INSERT only),
--                 published updates scoped to own feedback chain,
--                 reference data
--   teacher     — NO direct access to base feedback/extracted_issues/
--                 cluster_feedback/actions/action_updates tables;
--                 ALL data access through views in 002_views.sql
--   admin       — management access to non-sensitive data on base tables;
--                 sensitive feedback through sensitive_feedback_for_admin()
--
-- SECURITY NOTES (v2 — security review corrections):
--   1. Teacher SELECT policy on base feedback table REMOVED.
--      Teachers access feedback ONLY through feedback_for_teacher view,
--      which excludes student_id (column-level anonymisation).
--   2. Student UPDATE policy on feedback REMOVED.
--      Students can INSERT but cannot modify protected fields
--      (status, student_id, is_sensitive, analysed_at, reference_number).
--   3. Admin SELECT/UPDATE on base feedback EXCLUDES is_sensitive = true.
--      Sensitive feedback accessible only through
--      sensitive_feedback_for_admin() SECURITY DEFINER function.
--   4. Action updates scoped to student's own feedback chain via view.
--   5. Teacher write policies on analysis/management tables REMOVED
--      (write operations handled by admin/AI pipeline via service role).

-- ============================================================================
-- ENABLE RLS ON ALL APPLICATION TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_tag_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES
-- ============================================================================

-- All authenticated users can read their own profile
CREATE POLICY profiles_read_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins can read all profiles (user management)
CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

-- Admins can update any profile (role assignment, deactivation)
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

-- Admins can insert profiles (e.g. pre-creating teacher accounts)
CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- DEPARTMENTS (reference data — read by all; managed by admin)
-- ============================================================================

CREATE POLICY departments_read_all ON departments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY departments_admin_write ON departments
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- COURSES (reference data — read by all; managed by admin)
-- ============================================================================

CREATE POLICY courses_read_all ON courses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY courses_admin_write ON courses
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- COURSE SECTIONS
-- ============================================================================

-- Everyone reads course sections (needed for dropdowns)
CREATE POLICY course_sections_read_all ON course_sections
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY course_sections_admin_write ON course_sections
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- TEACHER ASSIGNMENTS
-- ============================================================================

-- Teachers read their own assignments
CREATE POLICY teacher_assignments_read_own ON teacher_assignments
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'teacher' AND teacher_id = auth.uid()
  );

-- Admins read all assignments
CREATE POLICY teacher_assignments_admin_read ON teacher_assignments
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

-- Admins manage assignments (assign teachers to courses)
CREATE POLICY teacher_assignments_admin_write ON teacher_assignments
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- FEEDBACK
-- ============================================================================
-- TEACHERS: no SELECT policy on the base table.
-- Teachers access feedback ONLY through the feedback_for_teacher view
-- (002_views.sql) which excludes student_id for anonymisation.
--
-- STUDENTS: INSERT only. No UPDATE policy — students cannot modify
-- protected fields (status, is_sensitive, analysed_at, reference_number,
-- student_id, submitted_at).

-- Students read their own feedback
CREATE POLICY feedback_student_read ON feedback
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'student' AND student_id = auth.uid()
  );

-- Students insert their own feedback (student_id must match caller)
CREATE POLICY feedback_student_insert ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'student' AND student_id = auth.uid()
  );

-- Admins read NON-SENSITIVE feedback only.
-- Sensitive feedback is accessible only through
-- sensitive_feedback_for_admin() SECURITY DEFINER function (002_views.sql).
CREATE POLICY feedback_admin_read ON feedback
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' AND is_sensitive = false);

-- Admins update NON-SENSITIVE feedback (change status, analysed_at).
-- Sensitive feedback updates must go through dedicated admin workflows.
CREATE POLICY feedback_admin_update ON feedback
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' AND is_sensitive = false);

-- ============================================================================
-- EXTRACTED ISSUES
-- ============================================================================
-- TEACHERS: no SELECT policy on the base table.
-- Teachers access extracted issues ONLY through the
-- extracted_issues_for_teacher view (002_views.sql).

-- Admins read all extracted issues
CREATE POLICY extracted_issues_admin_read ON extracted_issues
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

-- Admins manage extracted issues
CREATE POLICY extracted_issues_admin_write ON extracted_issues
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- ISSUE CLUSTERS
-- ============================================================================
-- TEACHERS: no SELECT policy on the base table.
-- Teachers access clusters ONLY through the clusters_for_teacher view
-- (002_views.sql).

-- Admins read all clusters
CREATE POLICY clusters_admin_read ON issue_clusters
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

-- Admins manage clusters
CREATE POLICY clusters_admin_write ON issue_clusters
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- CLUSTER FEEDBACK (junction table)
-- ============================================================================
-- TEACHERS: no SELECT policy on the base table.

-- Admins read and manage all junctions
CREATE POLICY cluster_feedback_admin_read ON cluster_feedback
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY cluster_feedback_admin_write ON cluster_feedback
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- CLUSTER TAG SYNONYMS
-- ============================================================================

-- All authenticated users can read synonyms (needed for cross-language grouping)
CREATE POLICY cluster_tag_synonyms_read ON cluster_tag_synonyms
  FOR SELECT TO authenticated
  USING (true);

-- Admins manage synonyms
CREATE POLICY cluster_tag_synonyms_admin_write ON cluster_tag_synonyms
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- ACTIONS
-- ============================================================================
-- TEACHERS: no SELECT/INSERT/UPDATE policies on the base table.
-- Teaching-action write operations are handled by admin or the
-- AI pipeline via the Supabase service role (bypasses RLS).

-- Admins read all actions
CREATE POLICY actions_admin_read ON actions
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

-- Admins manage all actions
CREATE POLICY actions_admin_write ON actions
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- ============================================================================
-- ACTION UPDATES
-- ============================================================================
-- STUDENTS: no direct SELECT policy on the base table.
-- Students access published updates ONLY through the
-- published_action_updates view (002_views.sql), which scopes results
-- to the student's own feedback chain via cluster_feedback.
--
-- TEACHERS: no policies on the base table.

-- Admins read all updates
CREATE POLICY action_updates_admin_read ON action_updates
  FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

-- Admins manage all updates (publish, approve, edit)
CREATE POLICY action_updates_admin_write ON action_updates
  FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
