-- Allow any valid email address during student registration.
-- Supabase confirmation verifies ownership; institution selection is still
-- required and stored in the authenticated profile.

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
