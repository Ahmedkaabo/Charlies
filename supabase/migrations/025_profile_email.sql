-- ============================================================
-- 025_profile_email.sql
-- Persist email on profiles so it's readable via normal RLS.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing rows from auth.users
UPDATE public.profiles p
SET    email = u.email
FROM   auth.users u
WHERE  u.id = p.id
  AND  p.email IS NULL;

-- Keep trigger in sync on every new signup
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
      'admin', 'branch_owner', 'area_manager', 'branch_manager', 'staff'
    )
    THEN new.raw_user_meta_data ->> 'system_role'
    ELSE 'staff'
  END;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, email, system_role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone',
    new.email,
    v_system_role
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone
    WHERE EXCLUDED.phone IS NOT NULL;

  RETURN new;
END;
$$;
