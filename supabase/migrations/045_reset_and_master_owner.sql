-- ============================================================
-- 045_reset_and_master_owner.sql
-- Wipes all user data and seeds a fresh master Owner account.
--
-- Master credentials:
--   Email:    owner@charlies.com
--   Password: Owner@123456
--   AccountID: 779685
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Wipe all user/business data ───────────────────────────
-- Truncate in dependency order; CASCADE handles cross-refs.

truncate table
  public.sales_edit_history,
  public.sales_records,
  public.finance_records,
  public.payroll_adjustments,
  public.payroll_records,
  public.expense_edits,
  public.expenses,
  public.attendance_logs,
  public.branch_ownership,
  public.branch_members,
  public.branch_shifts,
  public.branches,
  public.permissions,
  public.account_invites,
  public.accounts,
  public.salary_structures,
  public.profiles
cascade;

-- Delete all auth users (cascades to identities, sessions, etc.)
delete from auth.users;

-- Reset roles to clean state, then re-seed
truncate table public.roles cascade;

-- 'Owner' is the top system role (hidden from dropdowns via is_system=true).
-- Regular assignable roles start at level 2.
insert into public.roles (name, level, is_system, role_type) values
  ('Owner',          0, true,  'managerial'),
  ('area_manager',   2, false, 'managerial'),
  ('branch_manager', 3, false, 'managerial'),
  ('bar',            4, false, 'operational'),
  ('service',        5, false, 'operational')
on conflict (name) do nothing;

-- Re-seed expense categories
insert into public.expense_categories (name, icon) values
  ('Supplies',    'package'),
  ('Utilities',   'zap'),
  ('Salary',      'wallet'),
  ('Maintenance', 'wrench'),
  ('Equipment',   'cpu'),
  ('Other',       'more-horizontal')
on conflict (name) do nothing;

-- Reset account code sequence
alter sequence public.account_code_seq restart with 100000;

-- ── 2. Create master Owner ────────────────────────────────────

do $$
declare
  v_uid        uuid := gen_random_uuid();
  v_account_id uuid := gen_random_uuid();
begin

  -- Auth user
  insert into auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'owner@charlies.com',
    extensions.crypt('Owner@123456', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Charlie Owner"}'::jsonb,
    false, now(), now(),
    '', '', '', ''
  );

  -- Email identity (required for email sign-in)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', 'owner@charlies.com'),
    'email', 'owner@charlies.com',
    now(), now(), now()
  ) on conflict do nothing;

  -- Master account with fixed numeric code 779685
  insert into public.accounts (id, name, owner_id, code)
  values (v_account_id, 'Charlies HQ', v_uid, 779685);

  -- Profile (trigger may create it first; upsert handles both cases)
  insert into public.profiles (id, full_name, system_role, is_admin, account_id)
  values (v_uid, 'Charlie Owner', 'admin', true, v_account_id)
  on conflict (id) do update
    set full_name   = 'Charlie Owner',
        system_role = 'admin',
        is_admin    = true,
        account_id  = v_account_id;

end;
$$;
