-- 060_add_last_login.sql
-- Track when a user last signed in.
-- pending = last_login_at IS NULL (never logged in after being created)
-- active  = last_login_at IS NOT NULL (has signed in at least once)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
