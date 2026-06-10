-- Wipe all roles and permissions so the user can create their own from scratch.
-- Staff and owners keep their records but lose role assignments.

-- 1. Clear role assignments on staff and owners
UPDATE public.staff  SET role_id = NULL, role_ids = '{}';
UPDATE public.owners SET role_id = NULL, role_ids = '{}';

-- 2. Delete all roles (permissions cascade via FK ON DELETE CASCADE)
DELETE FROM public.roles;

-- 3. Update create_organization() to no longer auto-seed system roles.
--    The function still creates the account and promotes the user to admin;
--    role creation is left entirely to the user.
CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_account_id uuid;
  v_base_slug  text := p_slug;
  v_final_slug text := p_slug;
  v_counter    int  := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'create_organization: not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND account_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'create_organization: user already belongs to an organisation';
  END IF;

  -- Insert account, retrying with -N suffix on slug collisions.
  LOOP
    BEGIN
      INSERT INTO public.accounts (name, slug, owner_id)
      VALUES (p_name, v_final_slug, v_user_id)
      RETURNING id INTO v_account_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_counter    := v_counter + 1;
      v_final_slug := v_base_slug || '-' || v_counter::text;
      IF v_counter > 99 THEN
        RAISE EXCEPTION 'create_organization: could not generate unique slug';
      END IF;
    END;
  END LOOP;

  -- Promote profile: link to account and grant org-admin flag.
  UPDATE public.profiles
  SET account_id = v_account_id,
      is_admin   = true
  WHERE id = v_user_id;

  RETURN v_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization(text, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
