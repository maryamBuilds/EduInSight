-- EduInSight — show the student's name on identified feedback
-- Migration: 017_identified_feedback_names.sql
--
-- submit_feedback already stores the student's anonymity choice, but no staff
-- screen could show who sent identified feedback, so every submission looked
-- anonymous. The rule is now:
--   * Anonymous (default): nobody on staff sees the name.
--   * Identified: the teacher of that course section sees the student's name,
--     department and email (to follow up). Programme and study stage are
--     already part of every row. Admins already read profiles and departments under RLS
--     and resolve them in the app.
-- student_id itself is still never exposed to teachers.

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
  f.analysed_at,
  CASE
    WHEN f.is_anonymous THEN NULL
    ELSE (SELECT p.full_name FROM public.profiles p WHERE p.id = f.student_id)
  END AS student_name,
  CASE
    WHEN f.is_anonymous THEN NULL
    ELSE (SELECT d.name FROM public.departments d WHERE d.id = f.department_id)
  END AS student_department,
  CASE
    WHEN f.is_anonymous THEN NULL
    ELSE (SELECT p.email FROM public.profiles p WHERE p.id = f.student_id)
  END AS student_email
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
  'Teacher-safe feedback view. Excludes student_id and sensitive feedback. student_name, student_department and student_email are set only when the student chose to submit with their name. Restricted to the current teacher''s assigned sections.';

GRANT SELECT ON public.feedback_for_teacher TO authenticated;
