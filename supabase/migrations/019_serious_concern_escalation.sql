-- EduInSight — escalate serious concerns hidden in ordinary feedback areas
-- Migration: 019_serious_concern_escalation.sql
--
-- Migration 015 restricts feedback only when the student picks the
-- "Sensitive or serious concern" area. A student who describes harassment,
-- threats or self-harm under an ordinary area (for example "Teaching pace")
-- still reached the teacher. This migration closes that gap in two layers:
--
-- 1. Keyword safety net (no AI needed). A server-side trigger screens the
--    original text in English, Roman Urdu and Urdu on every insert and text
--    change. A match restricts the submission before it is ever saved as
--    ordinary feedback, so it is also never sent to the external AI.
-- 2. AI escalation. When a completed AI analysis has category
--    "Sensitive or serious concern" or sets serious_concern, the submission
--    is restricted and its analysis is flagged for human review.
--
-- Restricting a submission sets is_sensitive (which already hides it from
-- feedback_for_teacher, the teacher analysis/cluster views and ordinary admin
-- RLS) and removes it from issue clusters. The original text is never
-- changed. sensitive_reason records why it was restricted so an
-- administrator can see that a system, not the student, escalated it.

-- ============================================================================
-- 1. Columns
-- ============================================================================

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS sensitive_reason text,
  ADD COLUMN IF NOT EXISTS sensitive_flagged_at timestamptz;

ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS chk_feedback_sensitive_reason;
ALTER TABLE public.feedback
  ADD CONSTRAINT chk_feedback_sensitive_reason
  CHECK (sensitive_reason IS NULL
    OR sensitive_reason IN ('student_selected', 'keyword_screen', 'ai_escalation'));

COMMENT ON COLUMN public.feedback.sensitive_reason IS
  'Why the submission is restricted: student_selected (sensitive area chosen), keyword_screen (server keyword safety net) or ai_escalation (AI analysis flagged a serious concern). Escalations need human review.';

ALTER TABLE public.feedback_analysis
  ADD COLUMN IF NOT EXISTS serious_concern boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.feedback_analysis.serious_concern IS
  'Set by the AI when the text describes a serious or safety concern regardless of the chosen feedback area. A completed analysis with this flag restricts its feedback.';

-- ============================================================================
-- 2. Keyword safety net
-- ============================================================================
-- Deliberately narrow terms so ordinary academic complaints are not hidden
-- from teachers. English and Roman Urdu use word boundaries; Urdu script is
-- matched as a substring.

CREATE OR REPLACE FUNCTION private.text_mentions_serious_concern(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(p_text, '') ~* (
    '\m('
    -- English
    || 'harass\w*|sexual\w*|molest\w*|rape|raped|raping|rapist|grop(e|ed|es|ing)'
    || '|assault\w*|stalk(s|ed|er|ers|ing)?|blackmail\w*|threaten(s|ed|ing)?'
    || '|abus(e|ed|es|ing|ive)|bull(y|ied|ies|ying)|ragging|discriminat\w*'
    || '|brib(e|ed|es|ery|ing)|violen(ce|t)|suicid\w*|self[- ]?harm\w*'
    || '|kill(ing)? myself|end my life|hurt(ing)? myself|touched me|inappropriate(ly)? touch\w*'
    -- Roman Urdu
    || '|tang kart[aei]|chh?e[dr]h?(t[aei]|n[aei]|kh?ani|[ -]?chh?aa?r)?|ched ?khani|dhamk\w*|khud ?kushi|jinsi'
    || '|maar ?pee?t|mar ?pee?t|rishwat|gaali(yan|an)?'
    || ')\M'
    -- Urdu script
    || '|ہراس|جنسی|دھمک|خودکشی|خود کشی|بلیک میل|رشوت|چھیڑ|مار پیٹ|تشدد'
  );
$$;

REVOKE ALL ON FUNCTION private.text_mentions_serious_concern(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.text_mentions_serious_concern(text) FROM anon;
REVOKE ALL ON FUNCTION private.text_mentions_serious_concern(text) FROM authenticated;

-- ============================================================================
-- 3. Routing trigger (replaces the 015 version)
-- ============================================================================
-- Only ever escalates; it never clears is_sensitive. A row that already has
-- a reason (for example an AI escalation) keeps it.

CREATE OR REPLACE FUNCTION private.route_sensitive_feedback()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.feedback_area = 'Sensitive or serious concern' THEN
    NEW.is_sensitive := true;
    NEW.sensitive_reason := COALESCE(NEW.sensitive_reason, 'student_selected');
  ELSIF NEW.sensitive_reason IS NULL
    AND private.text_mentions_serious_concern(NEW.original_text) THEN
    NEW.is_sensitive := true;
    NEW.sensitive_reason := 'keyword_screen';
  END IF;

  IF NEW.is_sensitive AND NEW.sensitive_flagged_at IS NULL THEN
    NEW.sensitive_flagged_at := pg_catalog.now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.route_sensitive_feedback() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.route_sensitive_feedback() FROM anon;
REVOKE ALL ON FUNCTION private.route_sensitive_feedback() FROM authenticated;

DROP TRIGGER IF EXISTS trg_feedback_route_sensitive ON public.feedback;
CREATE TRIGGER trg_feedback_route_sensitive
  BEFORE INSERT OR UPDATE OF feedback_area, original_text, is_sensitive ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION private.route_sensitive_feedback();

-- ============================================================================
-- 4. Remove restricted feedback from clusters
-- ============================================================================
-- Recounts every affected cluster without restricted feedback. A cluster
-- whose summary was written from the restricted submission gets the summary
-- of its oldest remaining member; a cluster left with no visible members is
-- marked sensitive so clusters_for_teacher no longer shows it. Any existing
-- analysis of the restricted submission is flagged for human review.

CREATE OR REPLACE FUNCTION private.detach_sensitive_feedback(p_feedback_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cluster_ids uuid[];
  v_summary text;
BEGIN
  SELECT pg_catalog.array_agg(DISTINCT link.cluster_id)
  INTO v_cluster_ids
  FROM public.cluster_feedback link
  WHERE link.feedback_id = p_feedback_id;

  IF v_cluster_ids IS NULL THEN
    RETURN;
  END IF;

  SELECT analysis.english_summary
  INTO v_summary
  FROM public.feedback_analysis analysis
  WHERE analysis.feedback_id = p_feedback_id;

  DELETE FROM public.cluster_feedback link
  WHERE link.feedback_id = p_feedback_id;

  UPDATE public.issue_clusters cluster
  SET
    report_count = visible.member_count,
    summary = CASE
      WHEN v_summary IS NOT NULL AND cluster.summary = v_summary
        THEN COALESCE(visible.oldest_summary, cluster.summary)
      ELSE cluster.summary
    END,
    is_sensitive = cluster.is_sensitive OR visible.member_count = 0,
    updated_at = pg_catalog.now()
  FROM (
    SELECT
      cluster_id.id,
      (
        SELECT pg_catalog.count(DISTINCT link.feedback_id)::integer
        FROM public.cluster_feedback link
        INNER JOIN public.feedback feedback ON feedback.id = link.feedback_id
        WHERE link.cluster_id = cluster_id.id
          AND feedback.is_sensitive = false
      ) AS member_count,
      (
        SELECT analysis.english_summary
        FROM public.cluster_feedback link
        INNER JOIN public.feedback feedback ON feedback.id = link.feedback_id
        INNER JOIN public.feedback_analysis analysis ON analysis.feedback_id = feedback.id
        WHERE link.cluster_id = cluster_id.id
          AND feedback.is_sensitive = false
          AND analysis.english_summary IS NOT NULL
        ORDER BY feedback.submitted_at
        LIMIT 1
      ) AS oldest_summary
    FROM pg_catalog.unnest(v_cluster_ids) AS cluster_id(id)
  ) visible
  WHERE cluster.id = visible.id;
END;
$$;

REVOKE ALL ON FUNCTION private.detach_sensitive_feedback(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.detach_sensitive_feedback(uuid) FROM anon;
REVOKE ALL ON FUNCTION private.detach_sensitive_feedback(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION private.detach_feedback_on_restrict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.detach_sensitive_feedback(NEW.id);

  UPDATE public.feedback_analysis analysis
  SET requires_human_review = true
  WHERE analysis.feedback_id = NEW.id
    AND analysis.requires_human_review = false;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.detach_feedback_on_restrict() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.detach_feedback_on_restrict() FROM anon;
REVOKE ALL ON FUNCTION private.detach_feedback_on_restrict() FROM authenticated;

DROP TRIGGER IF EXISTS trg_feedback_detach_on_restrict ON public.feedback;
CREATE TRIGGER trg_feedback_detach_on_restrict
  AFTER UPDATE OF is_sensitive ON public.feedback
  FOR EACH ROW
  WHEN (OLD.is_sensitive = false AND NEW.is_sensitive = true)
  EXECUTE FUNCTION private.detach_feedback_on_restrict();

-- ============================================================================
-- 5. AI escalation
-- ============================================================================
-- Runs inside the same statement that saves the completed analysis, so the
-- submission is restricted before the Edge Function reaches clustering. An
-- AFTER trigger, because restricting the feedback updates this analysis row
-- again (requires_human_review) through trg_feedback_detach_on_restrict.

CREATE OR REPLACE FUNCTION private.escalate_serious_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.feedback feedback
  SET
    is_sensitive = true,
    sensitive_reason = COALESCE(feedback.sensitive_reason, 'ai_escalation')
  WHERE feedback.id = NEW.feedback_id
    AND feedback.is_sensitive = false;

  -- Feedback that was already restricted is not updated above.
  UPDATE public.feedback_analysis analysis
  SET requires_human_review = true
  WHERE analysis.feedback_id = NEW.feedback_id
    AND analysis.requires_human_review = false;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.escalate_serious_analysis() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.escalate_serious_analysis() FROM anon;
REVOKE ALL ON FUNCTION private.escalate_serious_analysis() FROM authenticated;

DROP TRIGGER IF EXISTS trg_feedback_analysis_escalate ON public.feedback_analysis;
CREATE TRIGGER trg_feedback_analysis_escalate
  AFTER INSERT OR UPDATE ON public.feedback_analysis
  FOR EACH ROW
  WHEN (NEW.status = 'completed'
    AND (NEW.serious_concern OR NEW.category = 'Sensitive or serious concern'))
  EXECUTE FUNCTION private.escalate_serious_analysis();

-- ============================================================================
-- 6. Existing data
-- ============================================================================

UPDATE public.feedback
SET
  sensitive_reason = 'student_selected',
  sensitive_flagged_at = COALESCE(sensitive_flagged_at, submitted_at)
WHERE feedback_area = 'Sensitive or serious concern'
  AND sensitive_reason IS NULL;

-- Keyword matches. The detach trigger removes them from clusters.
UPDATE public.feedback
SET is_sensitive = true
WHERE is_sensitive = false
  AND private.text_mentions_serious_concern(original_text);

-- Completed analyses the AI already classed as a serious concern. Touching
-- the row fires trg_feedback_analysis_escalate, which restricts its feedback.
UPDATE public.feedback_analysis
SET requires_human_review = true
WHERE status = 'completed'
  AND category = 'Sensitive or serious concern';

-- Any restricted feedback still linked to a cluster.
DO $$
DECLARE
  v_feedback_id uuid;
BEGIN
  FOR v_feedback_id IN
    SELECT DISTINCT link.feedback_id
    FROM public.cluster_feedback link
    INNER JOIN public.feedback feedback ON feedback.id = link.feedback_id
    WHERE feedback.is_sensitive = true
  LOOP
    PERFORM private.detach_sensitive_feedback(v_feedback_id);
  END LOOP;
END;
$$;

-- ============================================================================
-- 7. Restricted admin queue shows why each item is restricted
-- ============================================================================

DROP FUNCTION IF EXISTS public.sensitive_feedback_for_admin(uuid, uuid);

CREATE FUNCTION public.sensitive_feedback_for_admin(
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
  sensitive_reason text,
  sensitive_flagged_at timestamptz,
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
    f.sensitive_reason,
    f.sensitive_flagged_at,
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
  'SECURITY DEFINER RPC for admins only, scoped to the caller''s institution. Raises 42501 for non-admin callers. Masks student_id when is_anonymous=true. sensitive_reason shows whether the student, the keyword screen or the AI restricted the item.';

REVOKE ALL ON FUNCTION public.sensitive_feedback_for_admin(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sensitive_feedback_for_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sensitive_feedback_for_admin(uuid, uuid) TO authenticated;
