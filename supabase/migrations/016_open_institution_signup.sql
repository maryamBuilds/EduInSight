-- Open institution signup
-- A student may register with any university name. A matching active
-- institution is reused (ignoring case and spacing); otherwise a new one is
-- created and given the pilot institution's department list so Submit
-- Feedback works straight away ("Course not listed" covers courses).
-- The role is still forced to student. Safe to apply after 009.

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_institution_id uuid;
  v_institution_name text;
  v_email_domain text;
  v_pilot_institution_id uuid;
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
      v_institution_id := NULL;
  END;

  IF v_institution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.institutions AS institution
    WHERE institution.id = v_institution_id
      AND institution.is_active = true
  ) THEN
    v_institution_id := NULL;
  END IF;

  IF v_institution_id IS NULL THEN
    v_institution_name := pg_catalog.regexp_replace(
      pg_catalog.btrim(COALESCE(NEW.raw_user_meta_data->>'institution_name', '')),
      '\s+', ' ', 'g'
    );

    IF pg_catalog.char_length(v_institution_name) < 2
      OR pg_catalog.char_length(v_institution_name) > 150 THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'A valid educational institution name is required';
    END IF;

    SELECT institution.id
    INTO v_institution_id
    FROM public.institutions AS institution
    WHERE pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(institution.name), '\s+', ' ', 'g'))
      = pg_catalog.lower(v_institution_name)
      AND institution.is_active = true
    LIMIT 1;

    IF v_institution_id IS NULL THEN
      v_email_domain := NULLIF(pg_catalog.lower(pg_catalog.split_part(NEW.email, '@', 2)), '');

      INSERT INTO public.institutions (name, email_domains)
      VALUES (v_institution_name, ARRAY[COALESCE(v_email_domain, 'unknown')])
      ON CONFLICT (name) DO NOTHING
      RETURNING id INTO v_institution_id;

      IF v_institution_id IS NULL THEN
        -- Created by a concurrent signup, or exists but is inactive.
        SELECT institution.id
        INTO v_institution_id
        FROM public.institutions AS institution
        WHERE institution.name = v_institution_name
          AND institution.is_active = true;

        IF v_institution_id IS NULL THEN
          RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Selected educational institution is not available';
        END IF;
      ELSE
        SELECT institution.id
        INTO v_pilot_institution_id
        FROM public.institutions AS institution
        WHERE institution.name = 'Demo University';

        INSERT INTO public.departments (name, type, institution_id)
        SELECT department.name, department.type, v_institution_id
        FROM public.departments AS department
        WHERE department.institution_id = v_pilot_institution_id
        ON CONFLICT (institution_id, name) DO NOTHING;
      END IF;
    END IF;
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM authenticated;
