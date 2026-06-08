-- ============================================================
-- 020_phone_auth.sql
-- 1. Update profile trigger to capture phone from signup metadata
-- 2. Add RPC to look up email by phone (for phone-based sign-in)
-- ============================================================

-- ── 1. Update handle_new_user trigger ────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone
    WHERE EXCLUDED.phone IS NOT NULL;

  RETURN new;
END;
$$;

-- ── 2. Phone-to-email lookup (SECURITY DEFINER bypasses RLS) ─

CREATE OR REPLACE FUNCTION public.get_email_by_phone(p_phone text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.email::text
  FROM   auth.users   u
  JOIN   public.profiles p ON p.id = u.id
  WHERE  p.phone = p_phone
  LIMIT  1
$$;
