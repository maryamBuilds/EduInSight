-- EduInSight — Secure views and functions for role-based data access
-- Migration: 002_views.sql
--
-- PostgreSQL RLS controls ROW access, not COLUMN access.
-- Views run as the view owner (typically the postgres superuser) which
-- bypasses RLS on the underlying tables.  The WHERE clauses re-apply
-- access rules so each role sees only the rows it is authorised to see.
--
--   • Teachers see feedback WITHOUT student_id (column exclusion via view).
--   • Sensitive feedback is excluded from ordinary teacher access.
--   • Students see only their own feedback.
--   • Published action updates are scoped to the student's own feedback
--     chain through cluster_feedback.
--   • Sensitive feedback is accessible only through the admin RPC function.
--
-- IMPORTANT: auth.uid() is a session variable that always reflects the
-- calling user, even inside SECURITY DEFINER functions/views.

-- ============================================================================
-- 1. TEACHER-SAFE FEEDBACK VIEW
-- ============================================================================
-- Exposes feedback columns appropriate for teacher analytics.
-- • Excludes student_id entirely (teacher never sees who submitted).
-- • Restricts rows to course sections assigned to the calling teacher.
-- • Excludes sensitive feedback (is_sensitive = true).

CREATE OR REPLACE VIEW feedback_for_teacher
WITH (security_barrier = true)
AS
SELECT
  f.id,
  f.department_id,
  f.programme,
  f.study_structure,
  f.study_stage,
  f.university_service,
  f.course_id,
  f.course_section_id,
  f.custom_course_name,
  f.feedback_area,
  f.feedback_types,
  f.topic,
  f.original_text,
  f.language_detected,
  f.is_anonymous,
  f.status,
  f.reference_number,
  f.submitted_at,
  f.analysed_at
FROM feedback f
WHERE f.is_sensitive = false
  AND f.course_section_id IS NOT NULL
  AND is_teacher_assigned_to_section(auth.uid(), f.course_section_id);

COMMENT ON VIEW feedback_for_teacher IS
  'Teacher-safe feedback view. Excludes student_id and sensitive feedback. '
  'Restricted to course sections assigned to the current teacher. '
  'Students and non-teaching users get zero rows.';

-- Grant SELECT so all authenticated roles can query (view's WHERE clause
-- enforces teacher-only access regardless of the grant).
GRANT SELECT ON feedback_for_teacher TO authenticated;

-- ============================================================================
-- 2. TEACHER-SAFE EXTRACTED ISSUES VIEW
-- ============================================================================
-- Teachers can see extracted issues only for feedback they are allowed to view.
-- Joins through the teacher-safe feedback view to inherit its restrictions.

CREATE OR REPLACE VIEW extracted_issues_for_teacher
WITH (security_barrier = true)
AS
SELECT
  ei.id,
  ei.feedback_id,
  ei.issue_type,
  ei.problem_description,
  ei.topic,
  ei.sentiment,
  ei.semantic_tag,
  ei.suggested_category,
  ei.ai_confidence,
  ei.review_status,
  ei.created_at
FROM extracted_issues ei
INNER JOIN feedback_for_teacher tf ON tf.id = ei.feedback_id;

COMMENT ON VIEW extracted_issues_for_teacher IS
  'Extracted issues visible to teachers, scoped via feedback_for_teacher.';

GRANT SELECT ON extracted_issues_for_teacher TO authenticated;

-- ============================================================================
-- 3. TEACHER ISSUE CLUSTERS VIEW
-- ============================================================================
-- Teachers see clusters only for courses they are assigned to teach.

CREATE OR REPLACE VIEW clusters_for_teacher
WITH (security_barrier = true)
AS
SELECT ic.*
FROM issue_clusters ic
WHERE ic.is_sensitive = false
  AND ic.course_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM teacher_assignments ta
    INNER JOIN course_sections cs ON cs.id = ta.course_section_id
    WHERE ta.teacher_id = auth.uid()
      AND cs.course_id = ic.course_id
  );

COMMENT ON VIEW clusters_for_teacher IS
  'Issue clusters visible to teachers, scoped to assigned courses.';

GRANT SELECT ON clusters_for_teacher TO authenticated;

-- ============================================================================
-- 4. STUDENT OWN FEEDBACK VIEW
-- ============================================================================
-- Students can only see their own feedback. This view provides a
-- convenient interface; the WHERE clause enforces ownership.

CREATE OR REPLACE VIEW my_feedback
WITH (security_barrier = true)
AS
SELECT *
FROM feedback
WHERE student_id = auth.uid();

COMMENT ON VIEW my_feedback IS
  'Current student''s own feedback submissions.';

GRANT SELECT ON my_feedback TO authenticated;

-- ============================================================================
-- 5. PUBLISHED ACTION UPDATES VIEW (student-scoped)
-- ============================================================================
-- Students see only published updates for actions whose cluster contains
-- the student's own feedback.  This prevents unrelated students from
-- browsing other students' action/update history.
--
-- The view runs as the view owner (bypassing RLS on action_updates,
-- actions, and cluster_feedback) but filters via auth.uid() so only
-- the calling student's feedback chain is returned.
-- Unpublished drafts and internal notes are never exposed.

CREATE OR REPLACE VIEW published_action_updates
WITH (security_barrier = true)
AS
SELECT
  au.id,
  au.action_id,
  au.student_facing_message,
  au.published_at,
  a.cluster_id,
  a.action_type,
  a.title AS action_title,
  a.status AS action_status
FROM action_updates au
INNER JOIN actions a ON a.id = au.action_id
WHERE au.is_published = true
  AND EXISTS (
    SELECT 1
    FROM cluster_feedback cf
    INNER JOIN feedback f ON f.id = cf.feedback_id
    WHERE cf.cluster_id = a.cluster_id
      AND f.student_id = auth.uid()
  );

COMMENT ON VIEW published_action_updates IS
  'Published action updates scoped to the calling student''s own feedback chain. '
  'Unpublished drafts and internal notes are not exposed.';

GRANT SELECT ON published_action_updates TO authenticated;

-- ============================================================================
-- 6. ADMIN SENSITIVE-FEEDBACK RPC
-- ============================================================================
-- Ordinary admin RLS policies (in 003) exclude sensitive feedback.
-- This SECURITY DEFINER function bypasses RLS to provide a deliberately
-- restricted channel for authorised administrators to review sensitive
-- submissions.  Optional filters allow scoping by department and student.
--
-- Usage:
--   SELECT * FROM sensitive_feedback_for_admin();
--   SELECT * FROM sensitive_feedback_for_admin(p_department_id := '<uuid>');
--   SELECT * FROM sensitive_feedback_for_admin(p_student_id := '<uuid>');

CREATE OR REPLACE FUNCTION sensitive_feedback_for_admin(
  p_department_id uuid DEFAULT NULL,
  p_student_id    uuid DEFAULT NULL
)
RETURNS SETOF feedback
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM feedback
  WHERE is_sensitive = true
    AND (p_department_id IS NULL OR department_id = p_department_id)
    AND (p_student_id IS NULL OR student_id = p_student_id)
  ORDER BY submitted_at DESC;
$$;

COMMENT ON FUNCTION sensitive_feedback_for_admin IS
  'SECURITY DEFINER RPC for authorised admins only. '
  'Returns sensitive feedback rows excluded from the ordinary admin SELECT policy. '
  'Optional filters: p_department_id, p_student_id.';

REVOKE EXECUTE ON FUNCTION sensitive_feedback_for_admin(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION sensitive_feedback_for_admin(uuid, uuid) TO authenticated;
