-- EduInSight — automatic feedback clustering
-- Migration: 012_automatic_feedback_clustering.sql
--
-- Converts a completed, validated AI analysis into an institution-scoped
-- suggested issue cluster. The function is service-role only and idempotent:
-- retrying the same feedback never creates another issue or link.
-- AI-created clusters remain suggestions requiring administrator review.

ALTER TABLE public.issue_clusters
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id);

-- Existing clusters inherit their institution only from feedback already
-- linked to them. Unlinked legacy/demo clusters are deliberately not guessed.
UPDATE public.issue_clusters cluster
SET institution_id = source.institution_id
FROM (
  SELECT cf.cluster_id, pg_catalog.min(f.institution_id::text)::uuid AS institution_id
  FROM public.cluster_feedback cf
  INNER JOIN public.feedback f ON f.id = cf.feedback_id
  GROUP BY cf.cluster_id
  HAVING pg_catalog.count(DISTINCT f.institution_id) = 1
) source
WHERE cluster.id = source.cluster_id
  AND cluster.institution_id IS NULL;

CREATE INDEX idx_issue_clusters_institution_tag
  ON public.issue_clusters (institution_id, canonical_tag);

DROP POLICY clusters_admin_read ON public.issue_clusters;
DROP POLICY clusters_admin_write ON public.issue_clusters;

CREATE POLICY clusters_admin_read ON public.issue_clusters
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'admin'
    AND institution_id = (
      SELECT profile.institution_id
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
    )
  );

CREATE POLICY clusters_admin_write ON public.issue_clusters
  FOR ALL TO authenticated
  USING (
    private.get_user_role() = 'admin'
    AND institution_id = (
      SELECT profile.institution_id
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
    )
  )
  WITH CHECK (
    private.get_user_role() = 'admin'
    AND institution_id = (
      SELECT profile.institution_id
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
    )
  );

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

  -- The category was already validated against the controlled catalogue by
  -- the Edge Function. Revalidate here before deriving the stable key.
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

  -- Serialise creation for the same institution/category without depending
  -- on browser input or exposing this function to browser roles.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_feedback.institution_id::text || ':' || v_canonical_tag, 0)
  );

  SELECT cluster.id
  INTO v_cluster_id
  FROM public.issue_clusters cluster
  WHERE cluster.institution_id = v_feedback.institution_id
    AND cluster.canonical_tag = v_canonical_tag
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
  'Service-role-only, idempotent clustering of a completed non-sensitive AI analysis. Creates pending AI suggestions for human review.';

REVOKE ALL ON FUNCTION public.cluster_completed_feedback_analysis(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cluster_completed_feedback_analysis(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cluster_completed_feedback_analysis(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cluster_completed_feedback_analysis(uuid) TO service_role;
