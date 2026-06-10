-- Drop the legacy role_id FK column from staff and owners.
-- All role data now lives exclusively in role_ids uuid[].
-- Also null out any remaining stale role_id values and update
-- has_permission() + get_my_role_level() to only use role_ids.

-- 1. Null out any remaining stale role_id values
UPDATE public.staff  SET role_id = NULL WHERE role_id IS NOT NULL;
UPDATE public.owners SET role_id = NULL WHERE role_id IS NOT NULL;

-- 2. Update has_permission() to use only role_ids
CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.staff s
    JOIN   public.roles r ON r.id = ANY(s.role_ids)
    JOIN   public.permissions p ON p.role_id = r.id
    WHERE  s.profile_id = auth.uid()
      AND  s.is_active  = true
      AND  p.resource   = p_resource
      AND  (CASE p_action
              WHEN 'create' THEN p.can_create
              WHEN 'read'   THEN p.can_read
              WHEN 'update' THEN p.can_update
              WHEN 'delete' THEN p.can_delete
              ELSE false
            END) = true
  )
  OR EXISTS (
    SELECT 1
    FROM   public.owners o
    JOIN   public.roles r ON r.id = ANY(o.role_ids)
    JOIN   public.permissions p ON p.role_id = r.id
    WHERE  o.profile_id = auth.uid()
      AND  o.is_active  = true
      AND  p.resource   = p_resource
      AND  (CASE p_action
              WHEN 'create' THEN p.can_create
              WHEN 'read'   THEN p.can_read
              WHEN 'update' THEN p.can_update
              WHEN 'delete' THEN p.can_delete
              ELSE false
            END) = true
  )
$$;

-- 3. Update get_my_role_level() to use only role_ids
CREATE OR REPLACE FUNCTION public.get_my_role_level()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MIN(r.level), 99)
  FROM   public.roles r
  WHERE  EXISTS (
    SELECT 1 FROM public.staff  s WHERE s.profile_id = auth.uid() AND s.is_active = true AND r.id = ANY(s.role_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.owners o WHERE o.profile_id = auth.uid() AND o.is_active = true AND r.id = ANY(o.role_ids)
  )
$$;

NOTIFY pgrst, 'reload schema';
