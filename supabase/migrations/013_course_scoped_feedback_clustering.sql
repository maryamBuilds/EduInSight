-- EduInSight — course-scoped automatic feedback clustering
-- Migration: 013_course_scoped_feedback_clustering.sql
--
-- Course feedback must produce a course-owned cluster so assigned teachers
-- can review the bottleneck and create teaching actions. Institution-wide
-- feedback remains in institution-level clusters.

-- Repair existing clusters when every linked submission belongs to the same
-- course. This makes already-analysed course feedback immediately visible to
-- the assigned teacher without re-running the AI provider.
WITH course_scope AS (
  SELECT
    link.cluster_id,
    pg_catalog.min(feedback.course_id::text)::uuid AS course_id,
    pg_catalog.min(feedback.department_id::text)::uuid AS department_id
  FROM public.cluster_feedback link
  INNER JOIN public.feedback feedback ON feedback.id = link.feedback_id
  GROUP BY link.cluster_id
  HAVING pg_catalog.count(*) FILTER (WHERE feedback.course_id IS NULL) = 0
    AND pg_catalog.count(DISTINCT feedback.course_id) = 1
)
UPDATE public.issue_clusters cluster
SET
  course_id = course_scope.course_id,
  department_id = COALESCE(cluster.department_id, course_scope.department_id),
  updated_at = pg_catalog.now()
FROM course_scope
WHERE cluster.id = course_scope.cluster_id
  AND cluster.course_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_issue_clusters_institution_course_tag
  ON public.issue_clusters (institution_id, course_id, canonical_tag);

CREATE OR REPLACE FUNCTION public.cluster_completed_feedback_analysis(
  p_feedback_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_analysis public.feedback_analysis%ROWTYPE;
  v_feedback public.feedback%ROWTYPE;
  v_canonical_tag text;
  v_issue_type text;
  v_issue_id uuid;
  v_cluster_id uuid;
  v_priority_score numeric;
  v_scope_key text;
BEGIN
  SELECT analysis.*
  INTO v_analysis
  FROM public.feedback_analysis analysis
  WHERE analysis.feedback_id = p_feedback_id
    AND analysis.status = 'completed';

  IF NOT FOUND OR v_analysis.category IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT feedback.*
  INTO v_feedback
  FROM public.feedback feedback
  WHERE feedback.id = p_feedback_id
    AND feedback.is_sensitive = false;

  IF NOT FOUND OR v_feedback.institution_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_analysis.category NOT IN (
    'Difficulty understanding a concept',
    'Difficulty applying knowledge',
    'Teaching pace or explanation',
    'Course content or organisation',
    'Learning materials and resources',
    'Assignment instructions',
    'Assessment design or fairness',
    'Grading clarity',
    'Timetable or scheduling',
    'Staff communication or availability',
    'Technical access or system failure',
    'Service availability or delay',
    'Facilities or equipment condition',
    'Accessibility or inclusion',
    'Student wellbeing or support',
    'Positive experience',
    'Suggestion for improvement',
    'Sensitive or serious concern'
  ) THEN
    RETURN NULL;
  END IF;

  v_canonical_tag := pg_catalog.regexp_replace(
    pg_catalog.lower(v_analysis.category),
    '[^a-z0-9]+',
    '_',
    'g'
  );
  v_canonical_tag := pg_catalog.btrim(v_canonical_tag, '_');

  v_issue_type := CASE
    WHEN v_analysis.category = 'Positive experience' THEN 'positive'
    WHEN v_analysis.category = 'Suggestion for improvement' THEN 'suggestion'
    WHEN v_analysis.category = 'Difficulty understanding a concept' THEN 'learning_difficulty'
    WHEN v_analysis.category = 'Sensitive or serious concern' THEN 'support_request'
    ELSE 'problem'
  END;

  SELECT issue.id
  INTO v_issue_id
  FROM public.extracted_issues issue
  WHERE issue.feedback_id = p_feedback_id
    AND issue.semantic_tag = v_canonical_tag
  ORDER BY issue.created_at
  LIMIT 1;

  IF v_issue_id IS NULL THEN
    INSERT INTO public.extracted_issues (
      feedback_id,
      issue_type,
      problem_description,
      topic,
      sentiment,
      semantic_tag,
      suggested_category,
      ai_confidence,
      review_status
    ) VALUES (
      p_feedback_id,
      v_issue_type,
      v_analysis.english_summary,
      v_analysis.category,
      v_analysis.sentiment,
      v_canonical_tag,
      v_analysis.category,
      v_analysis.confidence,
      'pending'
    )
    RETURNING id INTO v_issue_id;
  END IF;

  -- A course ID is part of the lock and lookup scope. Feedback about the same
  -- category in different courses must not be merged into one teacher cluster.
  v_scope_key := COALESCE(v_feedback.course_id::text, 'institution');
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_feedback.institution_id::text || ':' || v_scope_key || ':' || v_canonical_tag,
      0
    )
  );

  SELECT cluster.id
  INTO v_cluster_id
  FROM public.issue_clusters cluster
  WHERE cluster.institution_id = v_feedback.institution_id
    AND cluster.canonical_tag = v_canonical_tag
    AND (
      (v_feedback.course_id IS NULL AND cluster.course_id IS NULL)
      OR cluster.course_id = v_feedback.course_id
    )
    AND cluster.status <> 'closed'
  ORDER BY cluster.created_at
  LIMIT 1;

  v_priority_score := CASE v_analysis.priority
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    ELSE 1
  END;

  IF v_cluster_id IS NULL THEN
    INSERT INTO public.issue_clusters (
      institution_id,
      title,
      summary,
      canonical_tag,
      course_id,
      department_id,
      university_service,
      feedback_area,
      report_count,
      sentiment_primary,
      priority_level,
      priority_score,
      priority_factors,
      ai_suggested_department,
      status
    ) VALUES (
      v_feedback.institution_id,
      v_analysis.category,
      v_analysis.english_summary,
      v_canonical_tag,
      v_feedback.course_id,
      v_feedback.department_id,
      v_feedback.university_service,
      v_feedback.feedback_area,
      0,
      v_analysis.sentiment,
      v_analysis.priority,
      v_priority_score,
      pg_catalog.jsonb_build_object(
        'source', 'ai_analysis',
        'requires_human_review', true,
        'confidence', v_analysis.confidence
      ),
      v_analysis.responsible_area,
      'open'
    )
    RETURNING id INTO v_cluster_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cluster_feedback link
    WHERE link.cluster_id = v_cluster_id
      AND link.feedback_id = p_feedback_id
      AND link.extracted_issue_id = v_issue_id
  ) THEN
    INSERT INTO public.cluster_feedback (cluster_id, feedback_id, extracted_issue_id)
    VALUES (v_cluster_id, p_feedback_id, v_issue_id);
  END IF;

  UPDATE public.issue_clusters cluster
  SET
    report_count = (
      SELECT pg_catalog.count(DISTINCT link.feedback_id)::integer
      FROM public.cluster_feedback link
      WHERE link.cluster_id = v_cluster_id
    ),
    priority_level = CASE
      WHEN cluster.priority_score IS NULL OR v_priority_score > cluster.priority_score
        THEN v_analysis.priority
      ELSE cluster.priority_level
    END,
    priority_score = CASE
      WHEN cluster.priority_score IS NULL OR v_priority_score > cluster.priority_score
        THEN v_priority_score
      ELSE cluster.priority_score
    END,
    updated_at = pg_catalog.now()
  WHERE cluster.id = v_cluster_id;

  RETURN v_cluster_id;
END;
$$;

COMMENT ON FUNCTION public.cluster_completed_feedback_analysis(uuid) IS
  'Service-role-only, idempotent clustering scoped by institution, course, and validated AI category.';

REVOKE ALL ON FUNCTION public.cluster_completed_feedback_analysis(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cluster_completed_feedback_analysis(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cluster_completed_feedback_analysis(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cluster_completed_feedback_analysis(uuid) TO service_role;

-- Recover any completed analyses that were never linked because clustering
-- previously stopped after analysis. Existing links are left untouched.
DO $$
DECLARE
  missing record;
BEGIN
  FOR missing IN
    SELECT analysis.feedback_id
    FROM public.feedback_analysis analysis
    INNER JOIN public.feedback feedback ON feedback.id = analysis.feedback_id
    WHERE analysis.status = 'completed'
      AND feedback.is_sensitive = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.cluster_feedback link
        WHERE link.feedback_id = analysis.feedback_id
      )
  LOOP
    PERFORM public.cluster_completed_feedback_analysis(missing.feedback_id);
  END LOOP;
END;
$$;
