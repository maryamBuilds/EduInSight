-- EduInSight — Database Security Validation Tests
-- File: supabase/tests/database_security.sql
--
-- Run AFTER all migrations (001 → 002 → 003 → 004 → 005) have been applied.
-- These assertions validate schema integrity and security configuration.
-- They check named objects individually (not brittle total counts).
--
-- Usage:
--   supabase db test       (if Supabase CLI + Docker are available)
--   psql -f supabase/tests/database_security.sql
--
-- This file is NOT a migration. It must not be placed in supabase/migrations/.

-- A. Required tables exist -----------------------------------------------

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'departments', 'profiles', 'courses', 'course_sections',
    'teacher_assignments', 'course_enrolments', 'feedback',
    'extracted_issues', 'issue_clusters', 'cluster_feedback',
    'cluster_tag_synonyms', 'actions', 'action_updates'
  ];
  v_t text;
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_t
    ) THEN
      RAISE EXCEPTION 'Missing table: %', v_t;
    END IF;
  END LOOP;
  RAISE NOTICE 'A. All required tables exist.';
END $$;

-- B. RLS enabled on all tables -------------------------------------------

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'profiles', 'departments', 'courses', 'course_sections',
    'teacher_assignments', 'course_enrolments', 'feedback',
    'extracted_issues', 'issue_clusters', 'cluster_feedback',
    'cluster_tag_synonyms', 'actions', 'action_updates'
  ];
  v_t text;
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_t AND c.relrowsecurity = true
    ) THEN
      RAISE EXCEPTION 'RLS not enabled on: %', v_t;
    END IF;
  END LOOP;
  RAISE NOTICE 'B. RLS enabled on all required tables.';
END $$;

-- C. Required policies exist ----------------------------------------------

DO $$
DECLARE
  v_policies text[] := ARRAY[
    'profiles_read_own', 'profiles_admin_read',
    'feedback_student_read', 'feedback_admin_read',
    'course_enrolments_student_read', 'course_enrolments_admin_read',
    'teacher_assignments_read_own',
    'departments_read_all', 'courses_read_all',
    'actions_admin_read', 'action_updates_admin_read'
  ];
  v_p text;
BEGIN
  FOREACH v_p IN ARRAY v_policies LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND policyname = v_p
    ) THEN
      RAISE EXCEPTION 'Missing policy: %', v_p;
    END IF;
  END LOOP;
  RAISE NOTICE 'C. All required RLS policies exist.';
END $$;

-- D. Required views exist ------------------------------------------------

DO $$
DECLARE
  v_views text[] := ARRAY[
    'feedback_for_teacher', 'extracted_issues_for_teacher',
    'clusters_for_teacher', 'my_feedback', 'published_action_updates'
  ];
  v_v text;
BEGIN
  FOREACH v_v IN ARRAY v_views LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v_v
    ) THEN
      RAISE EXCEPTION 'Missing view: %', v_v;
    END IF;
  END LOOP;
  RAISE NOTICE 'D. All required views exist.';
END $$;

-- E. Required functions exist --------------------------------------------

DO $$
DECLARE
  v_public_funcs text[] := ARRAY[
    'set_updated_at', 'sensitive_feedback_for_admin',
    'submit_feedback', 'teacher_acknowledge_cluster',
    'teacher_read_my_actions', 'teacher_create_action',
    'teacher_update_my_action', 'teacher_publish_update',
    'teacher_read_my_updates',
    'admin_create_action'
  ];
  v_private_funcs text[] := ARRAY[
    'get_user_role', 'get_teacher_section_ids',
    'is_teacher_assigned_to_section', 'get_my_section_ids',
    'handle_new_user'
  ];
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY v_public_funcs LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_fn
    ) THEN
      RAISE EXCEPTION 'Missing public function: %', v_fn;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY v_private_funcs LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = v_fn
    ) THEN
      RAISE EXCEPTION 'Missing private function: %', v_fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'E. All required functions exist in correct schemas.';
END $$;

-- F. Required UNIQUE constraints exist -----------------------------------

DO $$
DECLARE
  v_constraints text[] := ARRAY[
    'uq_teacher_section',
    'uq_cluster_tag_synonyms_canonical_tag',
    'uq_student_enrolment'
  ];
  v_c text;
BEGIN
  FOREACH v_c IN ARRAY v_constraints LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = v_c
    ) THEN
      RAISE EXCEPTION 'Missing UNIQUE constraint: %', v_c;
    END IF;
  END LOOP;
  RAISE NOTICE 'F. All required UNIQUE constraints exist.';
END $$;

-- G. Private helpers not executable by anon/authenticated -----------------
-- (except get_user_role which must remain callable for RLS policies)

DO $$
DECLARE
  v_restricted text[] := ARRAY[
    'get_teacher_section_ids(uuid)',
    'is_teacher_assigned_to_section(uuid, uuid)',
    'get_my_section_ids()',
    'handle_new_user()'
  ];
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY v_restricted LOOP
    IF has_function_privilege('authenticated', 'private.' || v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'private.% must NOT be executable by authenticated', v_sig;
    END IF;
    IF has_function_privilege('anon', 'private.' || v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'private.% must NOT be executable by anon', v_sig;
    END IF;
  END LOOP;

  -- get_user_role MUST remain callable by authenticated (used in RLS)
  IF NOT has_function_privilege('authenticated', 'private.get_user_role()', 'EXECUTE') THEN
    RAISE EXCEPTION 'private.get_user_role must be executable by authenticated (needed for RLS)';
  END IF;
  RAISE NOTICE 'G. Private helper EXECUTE permissions are correct.';
END $$;

-- G2. Schema USAGE on private -------------------------------------------
-- authenticated needs USAGE on private schema for RLS policy evaluation.
-- service_role needs USAGE for backend operations.
-- anon must NOT have USAGE: unauthenticated requests should never resolve
-- private schema objects.

DO $$
BEGIN
  IF NOT has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated must have USAGE on schema private (needed for RLS)';
  END IF;
  IF NOT has_schema_privilege('service_role', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'service_role must have USAGE on schema private (needed for backend ops)';
  END IF;
  IF has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'anon must NOT have USAGE on schema private';
  END IF;
  RAISE NOTICE 'G2. Schema USAGE on private is correct.';
END $$;

-- H. Authenticated-facing RPCs have intended EXECUTE ---------------------

DO $$
DECLARE
  v_rpcs text[] := ARRAY[
    'sensitive_feedback_for_admin(uuid,uuid)',
    'submit_feedback(uuid,text,text,text,text,uuid,uuid,text,text,text[],text,text,boolean)',
    'teacher_acknowledge_cluster(uuid)',
    'teacher_read_my_actions()',
    'teacher_create_action(uuid,text,text,text,date)',
    'teacher_update_my_action(uuid,text,text,text,text,date)',
    'teacher_publish_update(uuid,text)',
    'teacher_read_my_updates()',
    'admin_create_action(uuid,text,text,text,text,date,text,text)'
  ];
  v_rpc text;
BEGIN
  FOREACH v_rpc IN ARRAY v_rpcs LOOP
    IF NOT has_function_privilege('authenticated', 'public.' || v_rpc, 'EXECUTE') THEN
      RAISE EXCEPTION 'public.% must be executable by authenticated', v_rpc;
    END IF;
  END LOOP;
  RAISE NOTICE 'H. All authenticated-facing RPCs have EXECUTE.';
END $$;

-- I. All SECURITY DEFINER functions use safe search_path ------------------

DO $$
DECLARE
  v_func record;
BEGIN
  FOR v_func IN
    SELECT n.nspname || '.' || p.proname AS func_name, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname IN ('public', 'private')
      AND p.proname NOT IN ('set_updated_at')
  LOOP
    IF v_func.proconfig IS NULL
       OR pg_catalog.array_to_string(v_func.proconfig, ',') NOT LIKE '%search_path%' THEN
      RAISE EXCEPTION 'SECURITY DEFINER function % has no configured search_path', v_func.func_name;
    END IF;
  END LOOP;
  RAISE NOTICE 'I. All SECURITY DEFINER functions have search_path configured.';
END $$;

-- J. Teacher/admin RPCs have prosecdef = true ----------------------------

DO $$
DECLARE
  v_funcs text[] := ARRAY[
    'sensitive_feedback_for_admin', 'submit_feedback',
    'teacher_acknowledge_cluster', 'teacher_read_my_actions',
    'teacher_create_action', 'teacher_update_my_action',
    'teacher_publish_update', 'teacher_read_my_updates',
    'admin_create_action'
  ];
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY v_funcs LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
        AND p.prosecdef = true
    ) THEN
      RAISE EXCEPTION 'public.% must be SECURITY DEFINER (prosecdef = true)', v_fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'J. All teacher/admin RPCs are SECURITY DEFINER.';
END $$;

-- K. admin_create_action signature and permission checks -------------------

DO $$
DECLARE
  v_param_types text[];
BEGIN
  -- Verify exact parameter signature: uuid, text, text, text, text, date, text, text
  SELECT pg_catalog.array_agg(
    pg_catalog.format_type(p.proargtypes[s.i], NULL)
    ORDER BY s.i
  ) INTO v_param_types
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN pg_catalog.generate_series(0, 7) AS s(i)
  WHERE n.nspname = 'public' AND p.proname = 'admin_create_action';

  IF v_param_types IS NULL OR pg_catalog.array_length(v_param_types, 1) <> 8 THEN
    RAISE EXCEPTION 'admin_create_action must have exactly 8 parameters, got %',
      COALESCE(pg_catalog.array_length(v_param_types, 1)::text, 'null');
  END IF;

  IF v_param_types[1] <> 'uuid' THEN
    RAISE EXCEPTION 'admin_create_action param 1 must be uuid, got %', v_param_types[1];
  END IF;

  IF v_param_types[6] <> 'date' THEN
    RAISE EXCEPTION 'admin_create_action param 6 must be date, got %', v_param_types[6];
  END IF;

  -- Verify return type is uuid
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'admin_create_action'
      AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
  ) THEN
    RAISE EXCEPTION 'admin_create_action must return uuid';
  END IF;

  -- anon must NOT have EXECUTE
  IF has_function_privilege(
    'anon',
    'public.admin_create_action(uuid,text,text,text,text,date,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'admin_create_action must NOT be executable by anon';
  END IF;

  -- authenticated CAN invoke (role validation occurs internally)
  IF NOT has_function_privilege(
    'authenticated',
    'public.admin_create_action(uuid,text,text,text,text,date,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'admin_create_action must be executable by authenticated';
  END IF;

  RAISE NOTICE 'K. admin_create_action signature and permissions verified.';
END $$;

-- L. Broad privilege checks -----------------------------------------------
-- Verify that admin_create_action is not granted to PUBLIC.

DO $$
BEGIN
  IF has_function_privilege(
    'public',
    'public.admin_create_action(uuid,text,text,text,text,date,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'admin_create_action must NOT be granted to PUBLIC';
  END IF;
  RAISE NOTICE 'L. admin_create_action is not broadly granted.';
END $$;

-- M. Role-based access patterns (require live test data) -----------------
-- Uncomment and adapt with real UUIDs to run per-role tests.
--
-- -- Authenticated user with NULL or unavailable role
-- -- (e.g. authenticated via Supabase but no row in public.profiles)
-- -- get_user_role() returns NULL; IS DISTINCT FROM 'admin' is true;
-- -- function raises SQLSTATE 42501.
-- SET LOCAL ROLE authenticated;
-- SET request.jwt.claim.sub = '<user-without-profile-uuid>';
-- SELECT public.admin_create_action(
--   '<cluster-uuid>', 'Test title'
-- );  -- EXPECTED: EXCEPTION 42501 'Admin access required'
--
-- -- Student role
-- SET LOCAL ROLE authenticated;
-- SET request.jwt.claim.sub = '<student-uuid>';
-- SELECT count(*) FROM public.feedback;                     -- only own rows
-- SELECT count(*) FROM public.published_action_updates;     -- only own chain
-- SELECT count(*) FROM public.feedback_for_teacher;         -- zero (not teacher)
-- SELECT * FROM public.sensitive_feedback_for_admin();      -- EXCEPTION 42501
-- SELECT * FROM public.teacher_acknowledge_cluster('<id>'); -- EXCEPTION 42501
--
-- -- Teacher role
-- SET request.jwt.claim.sub = '<teacher-uuid>';
-- SELECT count(*) FROM public.feedback;                     -- zero (no grant needed; view)
-- SELECT count(*) FROM public.feedback_for_teacher;         -- assigned sections only
-- SELECT count(*) FROM public.action_updates;               -- zero (RPC only)
-- SELECT * FROM public.sensitive_feedback_for_admin();      -- EXCEPTION 42501
--
-- -- Admin role
-- SET request.jwt.claim.sub = '<admin-uuid>';
-- SELECT count(*) FROM public.feedback;                     -- non-sensitive only
-- SELECT count(*) FROM public.sensitive_feedback_for_admin(); -- sensitive rows
--
-- -- Unauthenticated (anon)
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.feedback;                     -- zero (no grants)
-- SELECT count(*) FROM public.departments;                  -- zero (no grants)
