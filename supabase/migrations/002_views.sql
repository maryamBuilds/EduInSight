-- EduInSight — Secure views, RPCs, and teacher functions
-- Migration: 002_views.sql
--
-- PostgreSQL RLS controls ROW access, not COLUMN access.
-- Views run as the view owner (typically the postgres superuser) which
-- bypasses RLS on the underlying tables.  The WHERE clauses re-apply
-- access rules so each role sees only the rows it is authorised to see.
--
-- DESIGN NOTE: Teacher views intentionally do NOT use security_invoker=true.
-- With owner privileges (the default), the view bypasses RLS on base tables,
-- which is required because teachers have NO direct SELECT on the feedback
-- table.  The view's WHERE clause enforces the same access rules plus
-- column-level anonymisation (excluding student_id).  auth.uid() is a
-- session variable that always reflects the calling user regardless of
-- the view's ownership model.

-- ============================================================================
-- 1. TEACHER-SAFE FEEDBACK VIEW
-- ============================================================================
-- Exposes feedback columns appropriate for teacher analytics.
-- Excludes student_id entirely (teacher never sees who submitted).
-- Restricts rows to course sections assigned to the calling teacher.
-- Excludes sensitive feedback (is_sensitive = true).
-- Includes explicit role check: non-teachers get zero rows.

CREATE OR REPLACE VIEW public.feedback_for_teacher
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
FROM public.feedback f
WHERE private.get_user_role() = 'teacher'
  AND f.is_sensitive = false
  AND f.course_section_id IS NOT NULL
  AND private.is_teacher_assigned_to_section(auth.uid(), f.course_section_id);

COMMENT ON VIEW public.feedback_for_teacher IS
  'Teacher-safe feedback view. Excludes student_id and sensitive feedback. Restricted to assigned sections. Non-teachers get zero rows.';

GRANT SELECT ON public.feedback_for_teacher TO authenticated;

-- ============================================================================
-- 2. TEACHER-SAFE EXTRACTED ISSUES VIEW
-- ============================================================================
-- Teachers see extracted issues only for feedback they are allowed to view.
-- Joins through feedback_for_teacher to inherit its restrictions.

CREATE OR REPLACE VIEW public.extracted_issues_for_teacher
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
FROM public.extracted_issues ei
INNER JOIN public.feedback_for_teacher tf ON tf.id = ei.feedback_id;

COMMENT ON VIEW public.extracted_issues_for_teacher IS
  'Extracted issues visible to teachers, scoped via feedback_for_teacher.';

GRANT SELECT ON public.extracted_issues_for_teacher TO authenticated;

-- ============================================================================
-- 3. TEACHER ISSUE CLUSTERS VIEW
-- ============================================================================
-- Teachers see non-sensitive clusters only for courses they teach.
-- Explicit column list (no SELECT *) for safety.

CREATE OR REPLACE VIEW public.clusters_for_teacher
WITH (security_barrier = true)
AS
SELECT
  ic.id,
  ic.title,
  ic.summary,
  ic.canonical_tag,
  ic.course_id,
  ic.department_id,
  ic.university_service,
  ic.feedback_area,
  ic.report_count,
  ic.feedback_share,
  ic.sentiment_primary,
  ic.trend,
  ic.priority_level,
  ic.priority_score,
  ic.priority_factors,
  ic.ai_suggested_response,
  ic.ai_suggested_department,
  ic.is_sensitive,
  ic.status,
  ic.created_at,
  ic.updated_at
FROM public.issue_clusters ic
WHERE private.get_user_role() = 'teacher'
  AND ic.is_sensitive = false
  AND ic.course_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.teacher_assignments ta
    INNER JOIN public.course_sections cs ON cs.id = ta.course_section_id
    WHERE ta.teacher_id = auth.uid()
      AND cs.course_id = ic.course_id
  );

COMMENT ON VIEW public.clusters_for_teacher IS
  'Issue clusters visible to teachers. Explicit role check, assignment check, and sensitivity filter.';

GRANT SELECT ON public.clusters_for_teacher TO authenticated;

-- ============================================================================
-- 4. STUDENT OWN FEEDBACK VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.my_feedback
WITH (security_barrier = true)
AS
SELECT
  f.id, f.student_id, f.department_id, f.programme, f.study_structure,
  f.study_stage, f.university_service, f.course_id, f.course_section_id,
  f.custom_course_name, f.feedback_area, f.feedback_types, f.topic,
  f.original_text, f.language_detected, f.is_anonymous, f.is_sensitive,
  f.status, f.reference_number, f.submitted_at, f.analysed_at
FROM public.feedback f
WHERE f.student_id = auth.uid();

COMMENT ON VIEW public.my_feedback IS
  'Current student''s own feedback submissions.';

GRANT SELECT ON public.my_feedback TO authenticated;

-- ============================================================================
-- 5. PUBLISHED ACTION UPDATES VIEW (student-scoped)
-- ============================================================================
-- Students see only published updates for actions whose cluster contains
-- the student's own feedback.  The view runs as owner (bypassing RLS on
-- action_updates, actions, cluster_feedback, feedback) but filters via
-- auth.uid() so only the calling student's chain is returned.

CREATE OR REPLACE VIEW public.published_action_updates
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
FROM public.action_updates au
INNER JOIN public.actions a ON a.id = au.action_id
WHERE au.is_published = true
  AND EXISTS (
    SELECT 1
    FROM public.cluster_feedback cf
    INNER JOIN public.feedback f ON f.id = cf.feedback_id
    WHERE cf.cluster_id = a.cluster_id
      AND f.student_id = auth.uid()
  );

COMMENT ON VIEW public.published_action_updates IS
  'Published action updates scoped to the calling student''s own feedback chain.';

GRANT SELECT ON public.published_action_updates TO authenticated;

-- ============================================================================
-- 6. ADMIN SENSITIVE-FEEDBACK RPC
-- ============================================================================
-- Ordinary admin RLS policies exclude sensitive feedback.
-- This SECURITY DEFINER function bypasses RLS to provide a deliberately
-- restricted channel for authorised administrators.
-- RAISE EXCEPTION (not silent zero rows) if the caller is not admin.

CREATE OR REPLACE FUNCTION public.sensitive_feedback_for_admin(
  p_department_id uuid DEFAULT NULL,
  p_student_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  department_id uuid,
  programme text,
  study_structure text,
  study_stage text,
  university_service text,
  course_id uuid,
  course_section_id uuid,
  custom_course_name text,
  feedback_area text,
  feedback_types text[],
  topic text,
  original_text text,
  language_detected text,
  is_anonymous boolean,
  is_sensitive boolean,
  status text,
  reference_number text,
  submitted_at timestamptz,
  analysed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  -- Explicit column list instead of SELECT *.
  -- student_id is masked (NULL) when the student chose anonymity.
  -- If a safeguarding investigation requires the student identity, the
  -- admin should query the base table through a separate, logged and
  -- audited channel — not through this routine.
  RETURN QUERY
  SELECT
    f.id,
    CASE WHEN f.is_anonymous THEN NULL ELSE f.student_id END,
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
    f.is_sensitive,
    f.status,
    f.reference_number,
    f.submitted_at,
    f.analysed_at
  FROM public.feedback f
  WHERE f.is_sensitive = true
    AND (p_department_id IS NULL OR f.department_id = p_department_id)
    AND (p_student_id IS NULL OR f.student_id = p_student_id)
  ORDER BY f.submitted_at DESC;
END;
$$;

COMMENT ON FUNCTION public.sensitive_feedback_for_admin IS
  'SECURITY DEFINER RPC for admins only. Raises 42501 for non-admin callers. Masks student_id when is_anonymous=true.';

REVOKE ALL ON FUNCTION public.sensitive_feedback_for_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sensitive_feedback_for_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sensitive_feedback_for_admin(uuid, uuid) TO authenticated;

-- ============================================================================
-- 7. STUDENT FEEDBACK SUBMISSION RPC
-- ============================================================================
-- Controlled submission path that replaces direct student INSERT on
-- public.feedback.  The database forces protected fields (student_id,
-- status, submitted_at, analysed_at, is_sensitive, language_detected,
-- reference_number).  Validates enrolment when course_section_id is given.

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_department_id    uuid,
  p_programme        text,
  p_study_structure  text,
  p_study_stage      text,
  p_university_service text,
  p_course_id        uuid DEFAULT NULL,
  p_course_section_id uuid DEFAULT NULL,
  p_custom_course_name text DEFAULT NULL,
  p_feedback_area    text DEFAULT '',
  p_feedback_types   text[] DEFAULT '{}',
  p_topic            text DEFAULT NULL,
  p_original_text    text DEFAULT '',
  p_is_anonymous     boolean DEFAULT true
)
RETURNS TABLE (id uuid, reference_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref text;
BEGIN
  -- Verify caller is an authenticated student
  IF private.get_user_role() <> 'student' THEN
    RAISE EXCEPTION 'Only students can submit feedback'
      USING ERRCODE = '42501';
  END IF;

  -- Reject empty or whitespace-only feedback text
  IF pg_catalog.btrim(p_original_text) = '' THEN
    RAISE EXCEPTION 'Feedback text must not be empty';
  END IF;

  -- Validate department exists
  IF NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = p_department_id) THEN
    RAISE EXCEPTION 'Invalid department';
  END IF;

  -- Validate course if provided
  IF p_course_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p_course_id) THEN
      RAISE EXCEPTION 'Invalid course';
    END IF;
    -- Course must belong to the selected department
    IF NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = p_course_id AND c.department_id = p_department_id
    ) THEN
      RAISE EXCEPTION 'Course does not belong to the selected department';
    END IF;
  END IF;

  -- Validate course section and enrolment if provided
  IF p_course_section_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.course_sections cs WHERE cs.id = p_course_section_id
    ) THEN
      RAISE EXCEPTION 'Invalid course section';
    END IF;
    -- Section must belong to the specified course (when course is given)
    IF p_course_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.course_sections cs
      WHERE cs.id = p_course_section_id AND cs.course_id = p_course_id
    ) THEN
      RAISE EXCEPTION 'Course section does not belong to the selected course';
    END IF;
    -- Student must be enrolled in this section
    IF NOT EXISTS (
      SELECT 1 FROM public.course_enrolments ce
      WHERE ce.student_id = auth.uid()
        AND ce.course_section_id = p_course_section_id
    ) THEN
      RAISE EXCEPTION 'You are not enrolled in this course section';
    END IF;
  END IF;

  -- Non-course university-service feedback: both course and section must be null
  IF p_course_id IS NULL AND p_course_section_id IS NOT NULL THEN
    RAISE EXCEPTION 'Course section requires a course';
  END IF;

  -- Generate a unique reference number
  v_ref := 'FB-'
    || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD')
    || '-'
    || pg_catalog.upper(pg_catalog.substr(
         pg_catalog.md5(pg_catalog.random()::text), 1, 6));

  RETURN QUERY
  INSERT INTO public.feedback (
    student_id, department_id, programme, study_structure, study_stage,
    university_service, course_id, course_section_id, custom_course_name,
    feedback_area, feedback_types, topic, original_text,
    is_anonymous, is_sensitive, status, reference_number,
    submitted_at, analysed_at, language_detected
  ) VALUES (
    auth.uid(), p_department_id, p_programme, p_study_structure, p_study_stage,
    p_university_service, p_course_id, p_course_section_id, p_custom_course_name,
    p_feedback_area, p_feedback_types, p_topic, p_original_text,
    p_is_anonymous, false, 'submitted', v_ref,
    pg_catalog.now(), NULL, NULL
  )
  RETURNING public.feedback.id, public.feedback.reference_number;
END;
$$;

COMMENT ON FUNCTION public.submit_feedback IS
  'Student submits feedback. Database forces student_id, status, timestamps, and validates enrolment.';

REVOKE ALL ON FUNCTION public.submit_feedback(
  uuid, text, text, text, text, uuid, uuid, text, text, text[], text, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_feedback(
  uuid, text, text, text, text, uuid, uuid, text, text, text[], text, text, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_feedback(
  uuid, text, text, text, text, uuid, uuid, text, text, text[], text, text, boolean
) TO authenticated;

-- ============================================================================
-- 8. TEACHER RPC FUNCTIONS
-- ============================================================================
-- SECURITY DEFINER functions that allow teachers to perform specific
-- operations without requiring service-role keys on the frontend.
--
-- Each function verifies:
--   - role = 'teacher' (via private.get_user_role())
--   - auth.uid() for the current teacher
--   - course assignment (via private.get_my_section_ids())
--   - ownership where required (created_by = auth.uid())
-- Unauthorized access raises SQLSTATE 42501.

-- --------------------------------------------------------------------------
-- 8a. Acknowledge a cluster assigned to the teacher's courses
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_acknowledge_cluster(p_cluster_id uuid)
RETURNS SETOF public.issue_clusters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_user_role() <> 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can acknowledge clusters'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.issue_clusters
  SET status = 'acknowledged', updated_at = pg_catalog.now()
  WHERE id = p_cluster_id
    AND course_id IS NOT NULL
    AND course_id IN (
      SELECT cs.course_id FROM public.course_sections cs
      WHERE cs.id = ANY(private.get_my_section_ids())
    )
  RETURNING public.issue_clusters.*;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cluster not found or not in your assigned courses'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.teacher_acknowledge_cluster IS
  'Teacher acknowledges a cluster for one of their assigned courses.';

REVOKE ALL ON FUNCTION public.teacher_acknowledge_cluster(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_acknowledge_cluster(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_acknowledge_cluster(uuid) TO authenticated;

-- --------------------------------------------------------------------------
-- 8b. Read teaching actions for clusters in the teacher's assigned courses
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_read_my_actions()
RETURNS TABLE (
  id uuid, cluster_id uuid, action_type text, title text, status text,
  responsible_department text, responsible_person text, deadline date,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.id, a.cluster_id, a.action_type, a.title, a.status,
    a.responsible_department, a.responsible_person, a.deadline,
    a.created_at, a.updated_at
  FROM public.actions a
  INNER JOIN public.issue_clusters ic ON ic.id = a.cluster_id
  WHERE private.get_user_role() = 'teacher'
    AND a.action_type = 'teaching'
    AND ic.course_id IS NOT NULL
    AND ic.course_id IN (
      SELECT cs.course_id FROM public.course_sections cs
      WHERE cs.id = ANY(private.get_my_section_ids())
    );
$$;

COMMENT ON FUNCTION public.teacher_read_my_actions IS
  'Teacher reads teaching actions for clusters in assigned courses. Excludes internal_note.';

REVOKE ALL ON FUNCTION public.teacher_read_my_actions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_read_my_actions() FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_read_my_actions() TO authenticated;

-- --------------------------------------------------------------------------
-- 8c. Create a teaching action for a cluster in the teacher's courses
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_create_action(
  p_cluster_id uuid,
  p_title text,
  p_responsible_department text DEFAULT NULL,
  p_responsible_person text DEFAULT NULL,
  p_deadline date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, cluster_id uuid, action_type text, title text, status text,
  responsible_department text, responsible_person text, deadline date,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_id uuid;
BEGIN
  IF private.get_user_role() <> 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can create teaching actions'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Action title must not be empty';
  END IF;

  SELECT ic.course_id INTO v_course_id
  FROM public.issue_clusters ic WHERE ic.id = p_cluster_id;

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Cluster not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.course_sections cs
    WHERE cs.id = ANY(private.get_my_section_ids())
      AND cs.course_id = v_course_id
  ) THEN
    RAISE EXCEPTION 'Cluster is not in one of your assigned courses'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  INSERT INTO public.actions (
    cluster_id, action_type, title, created_by,
    responsible_department, responsible_person, deadline
  ) VALUES (
    p_cluster_id, 'teaching', p_title, auth.uid(),
    p_responsible_department, p_responsible_person, p_deadline
  )
  RETURNING
    public.actions.id, public.actions.cluster_id, public.actions.action_type,
    public.actions.title, public.actions.status, public.actions.responsible_department,
    public.actions.responsible_person, public.actions.deadline,
    public.actions.created_at, public.actions.updated_at;
END;
$$;

COMMENT ON FUNCTION public.teacher_create_action IS
  'Teacher creates a teaching action for a cluster in their assigned courses.';

REVOKE ALL ON FUNCTION public.teacher_create_action(uuid, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_create_action(uuid, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_create_action(uuid, text, text, text, date) TO authenticated;

-- --------------------------------------------------------------------------
-- 8d. Update a teaching action the teacher created
-- --------------------------------------------------------------------------
-- RETURNS TABLE with explicit safe columns. Excludes internal_note,
-- created_by, and completed_at (admin-only data).

CREATE OR REPLACE FUNCTION public.teacher_update_my_action(
  p_action_id uuid,
  p_title text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_responsible_department text DEFAULT NULL,
  p_responsible_person text DEFAULT NULL,
  p_deadline date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, cluster_id uuid, action_type text, title text, status text,
  responsible_department text, responsible_person text, deadline date,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.get_user_role() <> 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can update teaching actions'
      USING ERRCODE = '42501';
  END IF;

  -- Validate status against allowed workflow values if provided
  IF p_status IS NOT NULL AND p_status NOT IN ('planned', 'assigned', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid action status: %', p_status;
  END IF;

  IF p_title IS NOT NULL AND pg_catalog.btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Action title must not be empty';
  END IF;

  RETURN QUERY
  UPDATE public.actions
  SET
    title = COALESCE(p_title, public.actions.title),
    status = COALESCE(p_status, public.actions.status),
    responsible_department = COALESCE(p_responsible_department, public.actions.responsible_department),
    responsible_person = COALESCE(p_responsible_person, public.actions.responsible_person),
    deadline = COALESCE(p_deadline, public.actions.deadline),
    updated_at = pg_catalog.now()
  WHERE public.actions.id = p_action_id
    AND public.actions.action_type = 'teaching'
    AND public.actions.created_by = auth.uid()
  RETURNING
    public.actions.id, public.actions.cluster_id, public.actions.action_type,
    public.actions.title, public.actions.status, public.actions.responsible_department,
    public.actions.responsible_person, public.actions.deadline,
    public.actions.created_at, public.actions.updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action not found or you did not create it'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.teacher_update_my_action IS
  'Teacher updates a teaching action they created. Returns safe columns only (no internal_note).';

REVOKE ALL ON FUNCTION public.teacher_update_my_action(uuid, text, text, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_update_my_action(uuid, text, text, text, text, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_update_my_action(uuid, text, text, text, text, date) TO authenticated;

-- --------------------------------------------------------------------------
-- 8e. Create and publish a student-facing update for a teacher's action
-- --------------------------------------------------------------------------
-- Teacher must have created the action. Action must be teaching type.
-- Action's cluster must be in the teacher's assigned courses.
-- Empty messages are rejected.

CREATE OR REPLACE FUNCTION public.teacher_publish_update(
  p_action_id uuid,
  p_student_facing_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_update_id uuid;
BEGIN
  IF private.get_user_role() <> 'teacher' THEN
    RAISE EXCEPTION 'Only teachers can publish action updates'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.btrim(p_student_facing_message) = '' THEN
    RAISE EXCEPTION 'Student-facing message must not be empty';
  END IF;

  -- Verify ownership AND that the cluster is in the teacher's courses
  IF NOT EXISTS (
    SELECT 1
    FROM public.actions a
    INNER JOIN public.issue_clusters ic ON ic.id = a.cluster_id
    WHERE a.id = p_action_id
      AND a.action_type = 'teaching'
      AND a.created_by = auth.uid()
      AND ic.course_id IS NOT NULL
      AND ic.course_id IN (
        SELECT cs.course_id FROM public.course_sections cs
        WHERE cs.id = ANY(private.get_my_section_ids())
      )
  ) THEN
    RAISE EXCEPTION 'Action not found, not yours, or not in your assigned courses'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.action_updates (
    action_id, student_facing_message, is_published, published_by, published_at
  ) VALUES (
    p_action_id, p_student_facing_message, true, auth.uid(), pg_catalog.now()
  )
  RETURNING public.action_updates.id INTO v_update_id;

  RETURN v_update_id;
END;
$$;

COMMENT ON FUNCTION public.teacher_publish_update IS
  'Teacher creates and publishes a student-facing update for their own action in an assigned course.';

REVOKE ALL ON FUNCTION public.teacher_publish_update(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_publish_update(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_publish_update(uuid, text) TO authenticated;

-- --------------------------------------------------------------------------
-- 8f. Read action updates for the teacher's own actions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_read_my_updates()
RETURNS TABLE (
  id uuid, action_id uuid, student_facing_message text,
  is_published boolean, published_by uuid, published_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.action_id, au.student_facing_message,
         au.is_published, au.published_by, au.published_at, au.created_at
  FROM public.action_updates au
  INNER JOIN public.actions a ON a.id = au.action_id
  WHERE private.get_user_role() = 'teacher'
    AND a.action_type = 'teaching'
    AND a.created_by = auth.uid();
$$;

COMMENT ON FUNCTION public.teacher_read_my_updates IS
  'Teacher reads action updates for their own teaching actions.';

REVOKE ALL ON FUNCTION public.teacher_read_my_updates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_read_my_updates() FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_read_my_updates() TO authenticated;
