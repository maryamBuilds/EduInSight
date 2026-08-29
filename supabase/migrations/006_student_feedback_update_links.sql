-- Link each student-visible action update to the student's specific feedback.
-- This keeps the detail page precise while preserving student scoping.
CREATE OR REPLACE VIEW public.published_action_updates
WITH (security_barrier = true)
AS
SELECT DISTINCT
  au.id,
  au.action_id,
  au.student_facing_message,
  au.published_at,
  a.cluster_id,
  a.action_type,
  a.title AS action_title,
  a.status AS action_status,
  f.id AS feedback_id
FROM public.action_updates au
INNER JOIN public.actions a ON a.id = au.action_id
INNER JOIN public.cluster_feedback cf ON cf.cluster_id = a.cluster_id
INNER JOIN public.feedback f ON f.id = cf.feedback_id
WHERE au.is_published = true
  AND f.student_id = auth.uid();

COMMENT ON VIEW public.published_action_updates IS
  'Published action updates linked to the calling student''s specific feedback submissions.';

GRANT SELECT ON public.published_action_updates TO authenticated;
