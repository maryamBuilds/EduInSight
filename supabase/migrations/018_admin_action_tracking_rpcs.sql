-- EduInSight — Admin action tracking RPCs
-- Migration: 018_admin_action_tracking_rpcs.sql
--
-- Lets an administrator keep an existing institutional action up to date
-- after it has been created: edit its details, move its progress status,
-- and publish follow-up messages to the affected students.
--
-- Follows the conventions established in 005_admin_action_rpcs.sql:
--   - SECURITY DEFINER with SET search_path = ''
--   - Internal role verification via private.get_user_role()
--   - REVOKE from PUBLIC and anon; GRANT only to authenticated
--   - Never accepts created_by, published_by or action_type from the browser

-- ============================================================================
-- ADMIN UPDATE ACTION
-- ============================================================================
-- Replaces the editable fields of an action. Empty text clears an optional
-- field. completed_at is maintained server-side from the status.

CREATE OR REPLACE FUNCTION public.admin_update_action(
  p_action_id uuid,
  p_title text,
  p_status text,
  p_responsible_department text DEFAULT NULL,
  p_responsible_person text DEFAULT NULL,
  p_deadline date DEFAULT NULL,
  p_internal_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF private.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR pg_catalog.btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Action title must not be empty';
  END IF;

  IF p_status IS NULL
     OR p_status NOT IN ('planned', 'assigned', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid action status: %', p_status;
  END IF;

  UPDATE public.actions
  SET
    title = pg_catalog.btrim(p_title),
    status = p_status,
    responsible_department = NULLIF(pg_catalog.btrim(p_responsible_department), ''),
    responsible_person = NULLIF(pg_catalog.btrim(p_responsible_person), ''),
    deadline = p_deadline,
    internal_note = NULLIF(pg_catalog.btrim(p_internal_note), ''),
    completed_at = CASE
      WHEN p_status = 'completed'
        THEN COALESCE(public.actions.completed_at, pg_catalog.now())
      ELSE NULL
    END,
    updated_at = pg_catalog.now()
  WHERE public.actions.id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action not found';
  END IF;

  RETURN p_action_id;
END;
$$;

COMMENT ON FUNCTION public.admin_update_action IS
  'Admin edits an existing action (details and progress status). completed_at is set server-side.';

REVOKE ALL ON FUNCTION public.admin_update_action(
  uuid, text, text, text, text, date, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_action(
  uuid, text, text, text, text, date, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_action(
  uuid, text, text, text, text, date, text
) TO authenticated;

-- ============================================================================
-- ADMIN PUBLISH FOLLOW-UP
-- ============================================================================
-- Publishes a student-facing follow-up for an existing action.
-- published_by is always the caller.

CREATE OR REPLACE FUNCTION public.admin_publish_action_update(
  p_action_id uuid,
  p_student_facing_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_update_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF private.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_student_facing_message IS NULL
     OR pg_catalog.btrim(p_student_facing_message) = '' THEN
    RAISE EXCEPTION 'Student-facing message must not be empty';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.actions a WHERE a.id = p_action_id
  ) THEN
    RAISE EXCEPTION 'Action not found';
  END IF;

  INSERT INTO public.action_updates (
    action_id, student_facing_message, is_published, published_by, published_at
  ) VALUES (
    p_action_id, pg_catalog.btrim(p_student_facing_message), true, auth.uid(), pg_catalog.now()
  )
  RETURNING public.action_updates.id INTO v_update_id;

  RETURN v_update_id;
END;
$$;

COMMENT ON FUNCTION public.admin_publish_action_update IS
  'Admin publishes a student-facing follow-up for an existing action.';

REVOKE ALL ON FUNCTION public.admin_publish_action_update(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_publish_action_update(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_action_update(uuid, text) TO authenticated;
