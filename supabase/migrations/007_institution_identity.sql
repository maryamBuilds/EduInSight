-- EduInSight institution identity
-- Adds an approved institution to every profile and feedback submission.

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL UNIQUE,
  email_domains text[] NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT institutions_name_not_blank CHECK (pg_catalog.btrim(name) <> ''),
  CONSTRAINT institutions_domains_not_empty CHECK (pg_catalog.cardinality(email_domains) > 0)
);

COMMENT ON TABLE public.institutions IS
  'Approved educational institutions available during student registration.';

INSERT INTO public.institutions (name, email_domains)
VALUES ('Demo University', ARRAY['university.edu.pk'])
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.profiles ADD COLUMN institution_id uuid;
ALTER TABLE public.departments ADD COLUMN institution_id uuid;
ALTER TABLE public.feedback ADD COLUMN institution_id uuid;

UPDATE public.profiles
SET institution_id = (SELECT id FROM public.institutions WHERE name = 'Demo University')
WHERE institution_id IS NULL;

UPDATE public.departments
SET institution_id = (SELECT id FROM public.institutions WHERE name = 'Demo University')
WHERE institution_id IS NULL;

UPDATE public.feedback feedback
SET institution_id = profile.institution_id
FROM public.profiles profile
WHERE profile.id = feedback.student_id
  AND feedback.institution_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN institution_id SET NOT NULL,
  ADD CONSTRAINT profiles_institution_fk
    FOREIGN KEY (institution_id) REFERENCES public.institutions(id);

ALTER TABLE public.departments
  ALTER COLUMN institution_id SET NOT NULL,
  ADD CONSTRAINT departments_institution_fk
    FOREIGN KEY (institution_id) REFERENCES public.institutions(id);

ALTER TABLE public.feedback
  ALTER COLUMN institution_id SET NOT NULL,
  ADD CONSTRAINT feedback_institution_fk
    FOREIGN KEY (institution_id) REFERENCES public.institutions(id);

CREATE INDEX idx_profiles_institution ON public.profiles (institution_id);
CREATE INDEX idx_departments_institution ON public.departments (institution_id);
CREATE INDEX idx_feedback_institution ON public.feedback (institution_id);
CREATE UNIQUE INDEX uq_department_name_per_institution
  ON public.departments (institution_id, name);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institutions FROM anon, authenticated;
GRANT SELECT ON public.institutions TO anon, authenticated;

CREATE POLICY institutions_read_active ON public.institutions
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- New accounts must provide an active institution. Email ownership is
-- verified by Supabase's confirmation email. The role remains forced to student.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_institution_id uuid;
BEGIN
  BEGIN
    v_institution_id := (NEW.raw_user_meta_data->>'institution_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'A valid educational institution is required';
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.institutions institution
    WHERE institution.id = v_institution_id
      AND institution.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected educational institution is not available';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, email, role, institution_id, programme,
    study_structure, study_stage, avatar_initials
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'student',
    v_institution_id,
    NEW.raw_user_meta_data->>'programme',
    NEW.raw_user_meta_data->>'study_structure',
    NEW.raw_user_meta_data->>'study_stage',
    NEW.raw_user_meta_data->>'avatar_initials'
  );
  RETURN NEW;
END;
$$;

-- Feedback never trusts an institution supplied by the client. It inherits
-- the authenticated student's institution and rejects another institution's
-- department before the existing submit_feedback RPC inserts the row.
CREATE OR REPLACE FUNCTION private.set_feedback_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_institution_id uuid;
BEGIN
  SELECT profile.institution_id
  INTO v_institution_id
  FROM public.profiles profile
  WHERE profile.id = NEW.student_id;

  IF v_institution_id IS NULL THEN
    RAISE EXCEPTION 'Student profile has no educational institution';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.departments department
    WHERE department.id = NEW.department_id
      AND department.institution_id = v_institution_id
  ) THEN
    RAISE EXCEPTION 'Department does not belong to the student institution';
  END IF;

  NEW.institution_id := v_institution_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_feedback_institution() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_feedback_institution
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION private.set_feedback_institution();

-- Students only receive departments configured for their own institution.
DROP POLICY IF EXISTS departments_read_all ON public.departments;
CREATE POLICY departments_read_own_institution ON public.departments
  FOR SELECT TO authenticated
  USING (
    institution_id = (
      SELECT profile.institution_id
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
    )
  );

-- Append institution identity to the existing student-safe view.
CREATE OR REPLACE VIEW public.my_feedback
WITH (security_barrier = true)
AS
SELECT
  f.id, f.student_id, f.department_id, f.programme, f.study_structure,
  f.study_stage, f.university_service, f.course_id, f.course_section_id,
  f.custom_course_name, f.feedback_area, f.feedback_types, f.topic,
  f.original_text, f.language_detected, f.is_anonymous, f.is_sensitive,
  f.status, f.reference_number, f.submitted_at, f.analysed_at,
  f.institution_id
FROM public.feedback f
WHERE f.student_id = auth.uid();

GRANT SELECT ON public.my_feedback TO authenticated;
