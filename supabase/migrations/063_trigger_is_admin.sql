-- ============================================================
-- 063_trigger_is_admin.sql
-- Update handle_new_user so that when system_role = 'owner' is
-- passed in signup metadata the profile is created with
-- is_admin = true in the same transaction (SECURITY DEFINER,
-- bypasses RLS — no client-side UPDATE needed).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_system_role text;
BEGIN
  v_system_role := CASE
    WHEN new.raw_user_meta_data ->> 'system_role' IN (
      'owner', 'branch_owner', 'area_manager', 'branch_manager', 'staff'
    )
    THEN new.raw_user_meta_data ->> 'system_role'
    ELSE 'staff'
  END;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, email, system_role, is_admin)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone',
    new.email,
    v_system_role,
    -- Account owners get is_admin=true automatically, set in the trigger so
    -- no privileged client-side UPDATE is required.
    (v_system_role = 'owner')
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone
    WHERE EXCLUDED.phone IS NOT NULL;

  RETURN new;
END;
$$;
