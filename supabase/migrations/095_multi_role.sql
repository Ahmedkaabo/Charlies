-- Add role_ids uuid[] to staff and owners so a user can hold multiple roles.
-- Backfill from existing role_id. Update permission functions to check role_ids.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS role_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS role_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill: populate role_ids from the existing single role_id
UPDATE public.staff  SET role_ids = ARRAY[role_id] WHERE role_id IS NOT NULL AND role_ids = '{}';
UPDATE public.owners SET role_ids = ARRAY[role_id] WHERE role_id IS NOT NULL AND role_ids = '{}';

-- ── has_permission ────────────────────────────────────────────
-- Checks role_ids array first; falls back to role_id for rows not yet migrated.

CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.roles r ON r.id = ANY(
      COALESCE(
        NULLIF(s.role_ids, '{}'),
        CASE WHEN s.role_id IS NOT NULL THEN ARRAY[s.role_id] ELSE NULL END
      )
    )
    JOIN public.permissions p ON p.role_id = r.id
    WHERE s.profile_id = auth.uid()
      AND s.is_active = true
      AND p.resource = p_resource
      AND (
        CASE p_action
          WHEN 'create' THEN p.can_create
          WHEN 'read'   THEN p.can_read
          WHEN 'update' THEN p.can_update
          WHEN 'delete' THEN p.can_delete
          ELSE false
        END
      ) = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.owners o
    JOIN public.roles r ON r.id = ANY(
      COALESCE(
        NULLIF(o.role_ids, '{}'),
        CASE WHEN o.role_id IS NOT NULL THEN ARRAY[o.role_id] ELSE NULL END
      )
    )
    JOIN public.permissions p ON p.role_id = r.id
    WHERE o.profile_id = auth.uid()
      AND o.is_active = true
      AND p.resource = p_resource
      AND (
        CASE p_action
          WHEN 'create' THEN p.can_create
          WHEN 'read'   THEN p.can_read
          WHEN 'update' THEN p.can_update
          WHEN 'delete' THEN p.can_delete
          ELSE false
        END
      ) = true
  )
$$;

-- ── get_my_role_level ─────────────────────────────────────────
-- Returns minimum (= highest privilege) role level across all roles.

CREATE OR REPLACE FUNCTION public.get_my_role_level()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT MIN(r.level)
      FROM public.staff s
      JOIN public.roles r ON r.id = ANY(
        COALESCE(
          NULLIF(s.role_ids, '{}'),
          CASE WHEN s.role_id IS NOT NULL THEN ARRAY[s.role_id] ELSE NULL END
        )
      )
      WHERE s.profile_id = auth.uid() AND s.is_active = true
    ),
    (
      SELECT MIN(r.level)
      FROM public.owners o
      JOIN public.roles r ON r.id = ANY(
        COALESCE(
          NULLIF(o.role_ids, '{}'),
          CASE WHEN o.role_id IS NOT NULL THEN ARRAY[o.role_id] ELSE NULL END
        )
      )
      WHERE o.profile_id = auth.uid() AND o.is_active = true
    ),
    999
  )
$$;
