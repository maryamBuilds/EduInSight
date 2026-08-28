-- Repair student profile creation during Supabase Auth signup.
-- This forward migration is safe to apply after 006 and 007.

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_institution_id uuid;
  v_full_name text;
  v_programme text;
BEGIN
  -- Auth metadata is client supplied, so validate every required value before
  -- inserting a trusted public profile. NULLIF also handles empty strings.
  BEGIN
    v_institution_id := NULLIF(
      NEW.raw_user_meta_data->>'institution_id',
      ''
    )::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'A valid educational institution is required';
  END;

  IF v_institution_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.institutions AS institution
    WHERE institution.id = v_institution_id
      AND institution.is_active = true
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Selected educational institution is not available';
  END IF;

  v_full_name := NULLIF(
    pg_catalog.btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')),
    ''
  );
  v_programme := NULLIF(
    pg_catalog.btrim(COALESCE(NEW.raw_user_meta_data->>'programme', '')),
    ''
  );

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Student full name is required';
  END IF;

  IF v_programme IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Student degree programme is required';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    institution_id,
    programme,
    study_structure,
    study_stage,
    avatar_initials
  ) VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    'student',
    v_institution_id,
    v_programme,
    NULL,
    NULL,
    NULLIF(NEW.raw_user_meta_data->>'avatar_initials', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    institution_id = EXCLUDED.institution_id,
    programme = EXCLUDED.programme,
    avatar_initials = EXCLUDED.avatar_initials,
    updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

-- Recreate the trigger explicitly in case an earlier partial migration left
-- the function installed but the auth trigger missing or stale.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM authenticated;

