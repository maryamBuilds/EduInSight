-- EduInSight — AI feedback-analysis records
-- Migration: 011_feedback_analysis.sql
--
-- One structured AI analysis per feedback submission, stored separately from
-- public.feedback so any analysis failure leaves the original submission
-- untouched.  Rows are written exclusively by the service-role
-- analyze-feedback Edge Function; browser roles receive SELECT-only grants
-- guarded by RLS.
--
-- status:
--   pending    — recorded, analysis not yet attempted (also used for the
--                AI-not-configured state, flagged via error_code)
--   processing — an analysis call is in flight
--   completed  — validated structured analysis stored
--   failed     — safe machine error_code describes the failure reason
--
-- The table never stores the original feedback text or any student identity.

CREATE TABLE public.feedback_analysis (
  feedback_id uuid PRIMARY KEY REFERENCES public.feedback(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  detected_language text,
  english_summary text,
  category text,
  sentiment text,
  priority text,
  responsible_area text,
  key_topics text[] NOT NULL DEFAULT '{}',
  requires_human_review boolean NOT NULL DEFAULT true,
  confidence numeric,
  error_code text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  completed_at timestamptz,
  CONSTRAINT chk_feedback_analysis_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT chk_feedback_analysis_language
    CHECK (detected_language IS NULL OR detected_language IN ('en', 'ur', 'roman_ur', 'mixed')),
  CONSTRAINT chk_feedback_analysis_sentiment
    CHECK (sentiment IS NULL OR sentiment IN ('negative', 'neutral', 'positive')),
  CONSTRAINT chk_feedback_analysis_priority
    CHECK (priority IS NULL OR priority IN ('high', 'medium', 'low')),
  CONSTRAINT chk_feedback_analysis_confidence
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT chk_feedback_analysis_completed_has_result
    CHECK (status <> 'completed' OR (english_summary IS NOT NULL AND detected_language IS NOT NULL)),
  CONSTRAINT chk_feedback_analysis_completed_no_error
    CHECK (status <> 'completed' OR error_code IS NULL),
  CONSTRAINT chk_feedback_analysis_failed_has_reason
    CHECK (status <> 'failed' OR error_code IS NOT NULL),
  CONSTRAINT chk_feedback_analysis_unfinished_has_no_result
    CHECK (status NOT IN ('pending', 'processing')
      OR (english_summary IS NULL AND detected_language IS NULL
          AND sentiment IS NULL AND priority IS NULL AND completed_at IS NULL))
);

COMMENT ON TABLE public.feedback_analysis IS
  'Structured AI analysis per feedback submission. Written only by the service role; SELECT-only for browser roles under RLS. Never stores original feedback text or student identity.';

CREATE INDEX idx_feedback_analysis_retryable ON public.feedback_analysis (status)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_feedback_analysis_created_at ON public.feedback_analysis (created_at DESC);

CREATE TRIGGER trg_feedback_analysis_updated_at
  BEFORE UPDATE ON public.feedback_analysis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS and privileges
-- ============================================================================

ALTER TABLE public.feedback_analysis ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.feedback_analysis FROM anon;
REVOKE ALL ON public.feedback_analysis FROM authenticated;
-- SELECT grant is required for the student/admin RLS policies below to be
-- effective; teachers read through the feedback_analysis_for_teacher view.
-- No INSERT/UPDATE/DELETE grants: only the service-role Edge Function
-- (which bypasses RLS) writes analysis rows.
GRANT SELECT ON public.feedback_analysis TO authenticated;

-- Students: analysis of their own submissions only.
CREATE POLICY feedback_analysis_student_read ON public.feedback_analysis
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.feedback f
      WHERE f.id = feedback_id
        AND f.student_id = auth.uid()
    )
  );

-- Administrators: non-sensitive analysis within their own institution only.
-- Sensitive feedback keeps its existing restricted RPC workflow
-- (sensitive_feedback_for_admin) and is not exposed through this table.
CREATE POLICY feedback_analysis_admin_read ON public.feedback_analysis
  FOR SELECT TO authenticated
  USING (
    private.get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1
      FROM public.feedback f
      WHERE f.id = feedback_id
        AND f.is_sensitive = false
        AND f.institution_id = (
          SELECT p.institution_id
          FROM public.profiles p
          WHERE p.id = auth.uid()
        )
    )
  );

-- ============================================================================
-- Teacher-safe analysis view
-- ============================================================================
-- Inherits every restriction of feedback_for_teacher: teacher role check,
-- assigned sections only, sensitive feedback excluded, no student identity.
-- Same pattern as extracted_issues_for_teacher.

CREATE OR REPLACE VIEW public.feedback_analysis_for_teacher
WITH (security_barrier = true)
AS
SELECT
  fa.feedback_id,
  fa.status,
  fa.detected_language,
  fa.english_summary,
  fa.category,
  fa.sentiment,
  fa.priority,
  fa.responsible_area,
  fa.key_topics,
  fa.requires_human_review,
  fa.confidence,
  fa.error_code,
  fa.attempts,
  fa.created_at,
  fa.updated_at,
  fa.completed_at
FROM public.feedback_analysis fa
INNER JOIN public.feedback_for_teacher tf ON tf.id = fa.feedback_id;

COMMENT ON VIEW public.feedback_analysis_for_teacher IS
  'AI analysis visible to teachers. Scoped through feedback_for_teacher: teacher role check, assigned sections only, sensitive feedback excluded, no student identity exposed.';

GRANT SELECT ON public.feedback_analysis_for_teacher TO authenticated;
