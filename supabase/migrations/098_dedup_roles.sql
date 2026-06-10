-- Remove duplicate roles that accumulated from multiple seeding migrations.
-- For each (account_id, name) pair, keep the canonical row:
--   priority: is_system=true > lower level > earliest created_at.
-- All FK references (staff.role_id, owners.role_id, staff.role_ids,
-- owners.role_ids) are remapped to the canonical row before deletion.
-- Permissions from duplicates are merged (OR) into the canonical row.

DO $$
DECLARE
  v_rec record;
BEGIN

  -- ── 1. Build canonical map ─────────────────────────────────────
  -- For each (account_id, name), pick the ONE row to keep.
  CREATE TEMP TABLE _canon ON COMMIT DROP AS
  SELECT DISTINCT ON (account_id, name)
    id   AS canon_id,
    name,
    account_id
  FROM public.roles
  WHERE account_id IS NOT NULL
  ORDER BY account_id, name,
    (is_system IS TRUE) DESC,
    level ASC,
    id ASC;

  -- ── 2. Build duplicate map ──────────────────────────────────────
  -- (dup_id → canon_id) for every non-canonical row.
  CREATE TEMP TABLE _dupe_map ON COMMIT DROP AS
  SELECT r.id AS dup_id, c.canon_id
  FROM public.roles r
  JOIN _canon c ON c.account_id = r.account_id AND c.name = r.name
  WHERE r.id != c.canon_id;

  -- ── 3. Remap staff.role_id ──────────────────────────────────────
  UPDATE public.staff s
  SET role_id = d.canon_id
  FROM _dupe_map d
  WHERE s.role_id = d.dup_id;

  -- ── 4. Remap owners.role_id ─────────────────────────────────────
  UPDATE public.owners o
  SET role_id = d.canon_id
  FROM _dupe_map d
  WHERE o.role_id = d.dup_id;

  -- ── 5. Remap staff.role_ids (array) ─────────────────────────────
  UPDATE public.staff s
  SET role_ids = (
    SELECT ARRAY_AGG(COALESCE(d.canon_id, elem) ORDER BY ordinality)
    FROM UNNEST(s.role_ids) WITH ORDINALITY AS t(elem, ordinality)
    LEFT JOIN _dupe_map d ON d.dup_id = t.elem
  )
  WHERE s.role_ids IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM UNNEST(s.role_ids) elem
      JOIN _dupe_map d ON d.dup_id = elem
    );

  -- ── 6. Remap owners.role_ids (array) ────────────────────────────
  UPDATE public.owners o
  SET role_ids = (
    SELECT ARRAY_AGG(COALESCE(d.canon_id, elem) ORDER BY ordinality)
    FROM UNNEST(o.role_ids) WITH ORDINALITY AS t(elem, ordinality)
    LEFT JOIN _dupe_map d ON d.dup_id = t.elem
  )
  WHERE o.role_ids IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM UNNEST(o.role_ids) elem
      JOIN _dupe_map d ON d.dup_id = elem
    );

  -- ── 7. Merge permissions from dupes into canonical rows ──────────
  -- Copy/OR any permission flags that only exist on duplicates.
  INSERT INTO public.permissions (role_id, resource, can_create, can_read, can_update, can_delete)
  SELECT d.canon_id, p.resource, p.can_create, p.can_read, p.can_update, p.can_delete
  FROM public.permissions p
  JOIN _dupe_map d ON d.dup_id = p.role_id
  ON CONFLICT (role_id, resource) DO UPDATE
    SET can_read   = public.permissions.can_read   OR EXCLUDED.can_read,
        can_create = public.permissions.can_create OR EXCLUDED.can_create,
        can_update = public.permissions.can_update OR EXCLUDED.can_update,
        can_delete = public.permissions.can_delete OR EXCLUDED.can_delete;

  -- ── 8. Delete duplicate role rows (permissions cascade via FK) ───
  DELETE FROM public.roles
  WHERE id IN (SELECT dup_id FROM _dupe_map);

END $$;

-- ── 9. Enforce uniqueness going forward ───────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS roles_account_name_idx
  ON public.roles(account_id, name)
  WHERE account_id IS NOT NULL;
