-- ============================================================
-- 001_initial_schema.sql
-- Charlie's Cafe — initial schema, indexes, RLS, policies
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

create table public.profiles (
  id          uuid        primary key references auth.users on delete cascade,
  full_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table public.branches (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  address     text,
  city        text,
  phone       text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  owner_id    uuid        references public.profiles(id)
);

create table public.roles (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique,
  level int  not null  -- 1=owner  2=area_manager  3=branch_manager  4=staff
);

create table public.branch_members (
  id          uuid        primary key default gen_random_uuid(),
  branch_id   uuid        not null references public.branches(id)  on delete cascade,
  profile_id  uuid        not null references public.profiles(id)  on delete cascade,
  role_id     uuid        references public.roles(id),
  joined_at   timestamptz not null default now(),
  is_active   boolean     not null default true,
  unique (branch_id, profile_id)
);

create table public.expense_categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  icon  text
);

create table public.expenses (
  id           uuid          primary key default gen_random_uuid(),
  branch_id    uuid          not null references public.branches(id)         on delete cascade,
  category_id  uuid          references public.expense_categories(id),
  amount       numeric(10,2) not null,
  currency     text          not null default 'EGP',
  description  text,
  date         date          not null default current_date,
  added_by     uuid          references public.profiles(id),
  receipt_url  text,
  created_at   timestamptz   not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────

create index on public.branch_members (profile_id);
create index on public.branch_members (branch_id);
create index on public.expenses (branch_id);
create index on public.expenses (date);
create index on public.expenses (added_by);

-- ── Helper functions ─────────────────────────────────────────
-- Both run as SECURITY DEFINER so they bypass RLS and are safe
-- to call from within policy USING / WITH CHECK expressions.

-- Returns the user's role level for a branch (null = not a member).
create or replace function public.user_branch_role_level(p_branch_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select r.level
  from   public.branch_members bm
  join   public.roles           r  on r.id = bm.role_id
  where  bm.branch_id  = p_branch_id
    and  bm.profile_id = auth.uid()
    and  bm.is_active  = true
  limit 1
$$;

-- ── Auto-add branch owner to branch_members on creation ──────
-- Runs after INSERT on branches so the owner can immediately
-- manage the branch without a separate INSERT into branch_members.

create or replace function public.handle_branch_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_role_id uuid;
begin
  select id into v_owner_role_id
  from   public.roles
  where  name = 'owner'
  limit  1;

  insert into public.branch_members (branch_id, profile_id, role_id)
  values (new.id, new.owner_id, v_owner_role_id)
  on conflict (branch_id, profile_id) do nothing;

  return new;
end;
$$;

create trigger on_branch_created
  after insert on public.branches
  for each row
  execute function public.handle_branch_created();

-- ── Enable RLS ───────────────────────────────────────────────

alter table public.profiles           enable row level security;
alter table public.branches           enable row level security;
alter table public.roles              enable row level security;
alter table public.branch_members     enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses           enable row level security;

-- ── Policies: profiles ───────────────────────────────────────

create policy "users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Trigger (002) inserts the row; this is a safety fallback.
create policy "users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using     (id = auth.uid())
  with check (id = auth.uid());

-- ── Policies: roles ──────────────────────────────────────────

create policy "authenticated users can read roles"
  on public.roles for select
  to authenticated
  using (true);

-- ── Policies: branches ───────────────────────────────────────

-- Members see only branches they belong to; owner always sees their branch
-- even if the branch_members trigger hasn't run yet.
create policy "members can read their branches"
  on public.branches for select
  to authenticated
  using (
    public.user_branch_role_level(id) is not null
    or owner_id = auth.uid()
  );

-- Any authenticated user may create a branch; they must set themselves as owner.
create policy "authenticated users can create a branch"
  on public.branches for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "owner or area_manager can update branches"
  on public.branches for update
  to authenticated
  using     (public.user_branch_role_level(id) <= 2)
  with check (public.user_branch_role_level(id) <= 2);

-- ── Policies: branch_members ─────────────────────────────────

create policy "members can view other members in their branches"
  on public.branch_members for select
  to authenticated
  using (public.user_branch_role_level(branch_id) is not null);

create policy "owner or area_manager can add members"
  on public.branch_members for insert
  to authenticated
  with check (public.user_branch_role_level(branch_id) <= 2);

create policy "owner or area_manager can update members"
  on public.branch_members for update
  to authenticated
  using     (public.user_branch_role_level(branch_id) <= 2)
  with check (public.user_branch_role_level(branch_id) <= 2);

-- ── Policies: expense_categories ─────────────────────────────

create policy "authenticated users can read expense categories"
  on public.expense_categories for select
  to authenticated
  using (true);

-- ── Policies: expenses ───────────────────────────────────────

create policy "branch members can read their branch expenses"
  on public.expenses for select
  to authenticated
  using (public.user_branch_role_level(branch_id) is not null);

-- branch_manager (level 3) and above; added_by must be the caller.
create policy "branch manager and above can insert expenses"
  on public.expenses for insert
  to authenticated
  with check (
    public.user_branch_role_level(branch_id) <= 3
    and added_by = auth.uid()
  );
