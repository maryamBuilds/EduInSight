-- EduInSight — Admin atomic action creation RPC
-- Migration: 005_admin_action_rpcs.sql
--
-- SECURITY DEFINER function that atomically creates an institutional action,
-- updates the linked cluster status, and optionally publishes a student-facing
-- update.  All operations run inside a single function call so any failure
-- rolls back everything.
--
-- Follows the exact security conventions established in migrations 001–003:
--   - SET search_path = ''
--   - Schema-qualified database objects and genuine functions
--   - No pg_catalog.coalesce
--   - Internal role verification via private.get_user_role()
--   - REVOKE from PUBLIC and anon; GRANT only to authenticated
--   - Never accepts created_by, published_by or action_type from the browser

-- ============================================================================
-- ADMIN CREATE INSTITUTIONAL ACTION (atomic)
-- ============================================================================
-- Steps performed inside the RPC:
--   1. Verify auth.uid() is present (authenticated caller).
--   2. Verify private.get_user_role() IS DISTINCT FROM 'admin'.
--   3. Validate the target cluster exists.
--   4. Validate a non-empty action title.
--   5. Accept only valid action statuses: planned, assigned, in_progress,
--      completed.
--   6. Insert an institutional action with created_by = auth.uid().
--   7. Update the linked cluster status to action_created.
--   8. Optionally insert and immediately publish a non-empty student-facing
--      action update (is_published = true, published_by = auth.uid(),
--      published_at = now()).
--   9. Return the created action UUID.
--  10. All operations within the RPC so any failure rolls back everything.

CREATE OR REPLACE FUNCTION public.admin_create_action(
  p_cluster_id uuid,
  p_title text,
  p_status text DEFAULT 'assigned',
  p_responsible_department text DEFAULT NULL,
  p_responsible_person text DEFAULT NULL,
  p_deadline date DEFAULT NULL,
  p_internal_note text DEFAULT NULL,
  p_student_facing_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action_id uuid;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Verify caller is an admin (IS DISTINCT FROM rejects NULL roles)
  IF private.get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Validate the target cluster exists
  IF NOT EXISTS (
    SELECT 1 FROM public.issue_clusters ic WHERE ic.id = p_cluster_id
  ) THEN
    RAISE EXCEPTION 'Cluster not found';
  END IF;

  -- 4. Validate non-empty action title (NULL guard + whitespace trim)
  IF p_title IS NULL OR pg_catalog.btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Action title must not be empty';
  END IF;

  -- 5. Validate status against allowed values
  IF p_status NOT IN ('planned', 'assigned', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Invalid action status: %', p_status;
  END IF;

  -- 6. Insert the institutional action (created_by forced server-side)
  INSERT INTO public.actions (
    cluster_id, action_type, title, status, created_by,
    responsible_department, responsible_person, deadline, internal_note
  ) VALUES (
    p_cluster_id, 'institutional', p_title, p_status, auth.uid(),
    p_responsible_department, p_responsible_person, p_deadline, p_internal_note
  )
  RETURNING public.actions.id INTO v_action_id;

  -- 7. Update cluster status to action_created
  UPDATE public.issue_clusters
  SET status = 'action_created', updated_at = pg_catalog.now()
  WHERE public.issue_clusters.id = p_cluster_id;

  -- 8. Optionally insert and publish a student-facing update
  IF p_student_facing_message IS NOT NULL
     AND pg_catalog.btrim(p_student_facing_message) <> '' THEN
    INSERT INTO public.action_updates (
      action_id, student_facing_message, is_published, published_by, published_at
    ) VALUES (
      v_action_id, p_student_facing_message, true, auth.uid(), pg_catalog.now()
    );
  END IF;

  -- 9. Return the created action UUID
  RETURN v_action_id;
END;
$$;

COMMENT ON FUNCTION public.admin_create_action IS
  'Atomic admin action creation: inserts institutional action, updates cluster status, optionally publishes student-facing update. All-or-nothing.';

REVOKE ALL ON FUNCTION public.admin_create_action(
  uuid, text, text, text, text, date, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_action(
  uuid, text, text, text, text, date, text, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_action(
  uuid, text, text, text, text, date, text, text
) TO authenticated;
