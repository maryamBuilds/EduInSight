-- EduInSight — Repair teacher feedback view permissions
-- Migration: 010_fix_teacher_feedback_view.sql
--
-- The original view called private.is_teacher_assigned_to_section(), whose
-- EXECUTE permission is deliberately withheld from authenticated users.
-- PostgreSQL therefore rejected otherwise valid teacher reads with HTTP 403.
--
-- Keep the private helper protected. Scope the view with an explicit
-- assignment check tied to auth.uid() instead.

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
  AND EXISTS (
    SELECT 1
    FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
      AND ta.course_section_id = f.course_section_id
  );

COMMENT ON VIEW public.feedback_for_teacher IS
  'Teacher-safe feedback view. Excludes student_id and sensitive feedback. Restricted to the current teacher''s assigned sections.';

GRANT SELECT ON public.feedback_for_teacher TO authenticated;
