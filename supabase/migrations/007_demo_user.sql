-- ============================================================
-- 007_demo_user.sql
-- Demo member account for manual testing.
-- Email: demo@charlies.app   Password: Demo@2024
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_uid uuid := gen_random_uuid();
begin
  -- Skip if account already exists
  if exists (select 1 from auth.users where email = 'demo@charlies.app') then
    raise notice 'demo@charlies.app already exists — skipping.';
    return;
  end if;

  -- ── Auth user ─────────────────────────────────────────────
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo@charlies.app',
    extensions.crypt('Demo@2024', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Member"}'::jsonb,
    false,
    '', '', '', ''
  );

  -- ── Email identity (required for email sign-in) ───────────
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'demo@charlies.app'),
    'email',
    'demo@charlies.app',
    now(),
    now(),
    now()
  ) on conflict do nothing;

  -- ── Profile ───────────────────────────────────────────────
  -- The trigger (002) creates the row; this upsert ensures values
  -- are correct even if the trigger ran before the update below.
  insert into public.profiles (id, full_name, system_role)
  values (v_uid, 'Demo Member', 'staff')
  on conflict (id) do update
    set full_name   = 'Demo Member',
        system_role = 'staff';

end;
$$;
