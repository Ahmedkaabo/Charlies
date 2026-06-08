-- ============================================================
-- 044_accounts_module.sql
-- Accounts (tenant/org), invite links, and profile link.
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ── accounts ─────────────────────────────────────────────────

create table if not exists public.accounts (
  id         uuid        primary key default gen_random_uuid(),
  name       text,
  owner_id   uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── numeric account code (user-facing identifier) ─────────────

create sequence if not exists public.account_code_seq
  start with 100000 increment by 1 no cycle;

alter table public.accounts
  add column if not exists code bigint unique
    default nextval('public.account_code_seq');

-- ── profiles → accounts ───────────────────────────────────────

alter table public.profiles
  add column if not exists account_id uuid
    references public.accounts(id) on delete set null;

-- ── account_invites ───────────────────────────────────────────

create table if not exists public.account_invites (
  id         uuid        primary key default gen_random_uuid(),
  account_id uuid        not null references public.accounts(id) on delete cascade,
  token      text        unique not null default encode(gen_random_bytes(16), 'hex'),
  created_by uuid        references auth.users(id),
  expires_at timestamptz,
  max_uses   int,
  uses       int         not null default 0,
  created_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────

alter table public.accounts        enable row level security;
alter table public.account_invites enable row level security;

-- Accounts: owner has full control
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'accounts' and policyname = 'owner_manage_account'
  ) then
    create policy "owner_manage_account" on public.accounts
      for all using (owner_id = auth.uid());
  end if;
end $$;

-- Accounts: members can read their own account
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'accounts' and policyname = 'member_read_account'
  ) then
    create policy "member_read_account" on public.accounts
      for select using (
        id in (select account_id from public.profiles where id = auth.uid())
      );
  end if;
end $$;

-- Invites: account owner manages
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'account_invites' and policyname = 'owner_manage_invites'
  ) then
    create policy "owner_manage_invites" on public.account_invites
      for all using (
        account_id in (select id from public.accounts where owner_id = auth.uid())
      );
  end if;
end $$;

-- Invites: anyone can read by token (needed for invite landing page)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'account_invites' and policyname = 'public_read_invite'
  ) then
    create policy "public_read_invite" on public.account_invites
      for select using (true);
  end if;
end $$;
