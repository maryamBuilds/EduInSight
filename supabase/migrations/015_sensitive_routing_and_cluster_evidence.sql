-- EduInSight — sensitive-concern routing and traceable cluster evidence
-- Migration: 015_sensitive_routing_and_cluster_evidence.sql
--
-- 1. A submission whose feedback area is "Sensitive or serious concern" is
--    stored with is_sensitive = true. submit_feedback previously forced the
--    flag to false, so these concerns reached the ordinary teacher list and
--    were eligible for external AI analysis and clustering.
-- 2. Existing sensitive-area submissions are restricted and removed from
--    ordinary clusters.
-- 3. The restricted admin RPC is limited to the caller's own institution.
-- 4. Teachers can read cluster membership for their own visible feedback, so
--    dashboard evidence comes from cluster_feedback instead of topic matching.

-- ============================================================================
-- 1. Server-side sensitivity routing
-- ============================================================================
-- A trigger (rather than a client flag) keeps the decision on the server for
-- every insert path, including the existing submit_feedback RPC.

CREATE OR REPLACE FUNCTION private.route_sensitive_feedback()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.feedback_area = 'Sensitive or serious concern' THEN
    NEW.is_sensitive := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.route_sensitive_feedback() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.route_sensitive_feedback() FROM anon;
REVOKE ALL ON FUNCTION private.route_sensitive_feedback() FROM authenticated;

DROP TRIGGER IF EXISTS trg_feedback_route_sensitive ON public.feedback;
CREATE TRIGGER trg_feedback_route_sensitive
  BEFORE INSERT OR UPDATE OF feedback_area ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION private.route_sensitive_feedback();

-- ============================================================================
-- 2. Restrict existing sensitive-area submissions
-- ============================================================================

UPDATE public.feedback
SET is_sensitive = true
WHERE feedback_area = 'Sensitive or serious concern'
  AND is_sensitive = false;

-- Sensitive feedback must not count as, or be quoted as, ordinary cluster
-- evidence. Remove its links, then recount the affected clusters in a
-- separate statement so the count sees the deletion.
CREATE TEMPORARY TABLE sensitive_link_clusters AS
SELECT DISTINCT link.cluster_id
FROM public.cluster_feedback link
INNER JOIN public.feedback feedback ON feedback.id = link.feedback_id
WHERE feedback.is_sensitive = true;

DELETE FROM public.cluster_feedback link
USING public.feedback feedback
WHERE feedback.id = link.feedback_id
  AND feedback.is_sensitive = true;

UPDATE public.issue_clusters cluster
SET
  report_count = (
    SELECT pg_catalog.count(DISTINCT link.feedback_id)::integer
    FROM public.cluster_feedback link
    WHERE link.cluster_id = cluster.id
  ),
  updated_at = pg_catalog.now()
WHERE cluster.id IN (SELECT affected.cluster_id FROM sensitive_link_clusters affected);

DROP TABLE sensitive_link_clusters;

-- ============================================================================
-- 3. Restricted admin queue, scoped to the caller's institution
-- ============================================================================

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
  IF private.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  -- student_id is masked (NULL) when the student chose anonymity.
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
    AND f.institution_id = (
      SELECT p.institution_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND (p_department_id IS NULL OR f.department_id = p_department_id)
    AND (p_student_id IS NULL OR f.student_id = p_student_id)
  ORDER BY f.submitted_at DESC;
END;
$$;

COMMENT ON FUNCTION public.sensitive_feedback_for_admin IS
  'SECURITY DEFINER RPC for admins only, scoped to the caller''s institution. Raises 42501 for non-admin callers. Masks student_id when is_anonymous=true.';

-- ============================================================================
-- 4. Teacher-safe cluster membership
-- ============================================================================
-- Inherits every restriction of feedback_for_teacher: teacher role check,
-- assigned sections only, sensitive feedback excluded. Exposes IDs only.

CREATE OR REPLACE VIEW public.cluster_feedback_for_teacher
WITH (security_barrier = true)
AS
SELECT DISTINCT
  link.cluster_id,
  link.feedback_id
FROM public.cluster_feedback link
INNER JOIN public.feedback_for_teacher tf ON tf.id = link.feedback_id;

COMMENT ON VIEW public.cluster_feedback_for_teacher IS
  'Cluster membership for feedback the current teacher may already read through feedback_for_teacher.';

REVOKE ALL ON public.cluster_feedback_for_teacher FROM anon;
GRANT SELECT ON public.cluster_feedback_for_teacher TO authenticated;
