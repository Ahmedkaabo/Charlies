-- ============================================================
-- 004_schema_updates.sql
-- Alters existing tables, adds new tables, extends RLS.
-- Safe to apply once on top of 001 + 002 migrations.
-- ============================================================

-- ── 1. ALTER TABLE profiles ───────────────────────────────────

alter table public.profiles
  add column system_role text not null default 'staff'
    constraint profiles_system_role_check
    check (system_role in ('admin', 'branch_owner', 'area_manager', 'branch_manager', 'staff')),
  add column is_admin boolean not null default false;

-- Elevate the owner account to admin
update public.profiles
set    system_role = 'admin',
       is_admin    = true
where  id = (select id from auth.users where email = 'ahmedkaaboo@gmail.com');

-- ── 2. ALTER TABLE branches ───────────────────────────────────

alter table public.branches
  add column latitude                numeric(10, 8),
  add column longitude               numeric(11, 8),
  add column location_radius_meters  int not null default 10;

-- ── 3. Unique constraint on expense_categories.name ──────────
-- Required so seed.sql can use ON CONFLICT (name) DO NOTHING.

alter table public.expense_categories
  add constraint expense_categories_name_key unique (name);

-- ── 4. NEW TABLE: salary_structures ──────────────────────────

create table public.salary_structures (
  id             uuid          primary key default gen_random_uuid(),
  branch_id      uuid          not null references public.branches(id)  on delete cascade,
  profile_id     uuid          not null references public.profiles(id)  on delete cascade,
  monthly_salary numeric(10,2),
  currency       text          not null default 'EGP',
  effective_from date          not null default current_date,
  created_at     timestamptz   not null default now(),
  unique (branch_id, profile_id)
);

-- ── 5. NEW TABLE: attendance_logs ────────────────────────────

create table public.attendance_logs (
  id                        uuid          primary key default gen_random_uuid(),
  branch_id                 uuid          not null references public.branches(id)  on delete cascade,
  profile_id                uuid          not null references public.profiles(id)  on delete cascade,
  check_in_at               timestamptz,
  check_out_at              timestamptz,
  check_in_latitude         numeric(10, 8),
  check_in_longitude        numeric(11, 8),
  check_out_latitude        numeric(10, 8),
  check_out_longitude       numeric(11, 8),
  check_in_distance_meters  numeric,
  check_out_distance_meters numeric,
  status                    text          not null default 'present'
    constraint attendance_logs_status_check
    check (status in ('present', 'late', 'absent', 'rejected')),
  notes                     text,
  date                      date          not null default current_date,
  created_at                timestamptz   not null default now()
);

-- ── 6. Indexes ────────────────────────────────────────────────

create index on public.salary_structures (profile_id);
create index on public.salary_structures (branch_id);

create index on public.attendance_logs (branch_id, date);
create index on public.attendance_logs (profile_id);
create index on public.attendance_logs (date);

-- ── 7. Admin helper (SECURITY DEFINER — bypasses RLS) ────────

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$;

-- ── 8. Enable RLS on new tables ───────────────────────────────

alter table public.salary_structures enable row level security;
alter table public.attendance_logs   enable row level security;

-- ── 9. Policies: salary_structures ───────────────────────────
--
-- Permissive policies are OR-ed by Postgres — a row is visible
-- / writable if ANY matching policy passes.

-- Read: own salary
create policy "staff can read own salary"
  on public.salary_structures for select
  to authenticated
  using (profile_id = auth.uid());

-- Read: branch manager and above see their branch
create policy "branch managers can read branch salaries"
  on public.salary_structures for select
  to authenticated
  using (public.user_branch_role_level(branch_id) <= 3);

-- Read: admins see all
create policy "admins can read all salaries"
  on public.salary_structures for select
  to authenticated
  using (public.is_admin());

-- Insert: branch manager+ or admin
create policy "branch managers and admins can insert salaries"
  on public.salary_structures for insert
  to authenticated
  with check (
    public.user_branch_role_level(branch_id) <= 3
    or public.is_admin()
  );

-- Update: branch manager+ or admin
create policy "branch managers and admins can update salaries"
  on public.salary_structures for update
  to authenticated
  using (
    public.user_branch_role_level(branch_id) <= 3
    or public.is_admin()
  )
  with check (
    public.user_branch_role_level(branch_id) <= 3
    or public.is_admin()
  );

-- Delete: admin only
create policy "admins can delete salaries"
  on public.salary_structures for delete
  to authenticated
  using (public.is_admin());

-- ── 10. Policies: attendance_logs ────────────────────────────

-- Insert: staff log their own check-in / check-out
create policy "staff can insert own attendance"
  on public.attendance_logs for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Read: own rows
create policy "staff can read own attendance"
  on public.attendance_logs for select
  to authenticated
  using (profile_id = auth.uid());

-- Read: branch managers see their whole branch
create policy "branch managers can read branch attendance"
  on public.attendance_logs for select
  to authenticated
  using (public.user_branch_role_level(branch_id) <= 3);

-- Read: admins see everything
create policy "admins can read all attendance"
  on public.attendance_logs for select
  to authenticated
  using (public.is_admin());

-- Update: staff update own row (for check-out, distance fields)
create policy "staff can update own attendance"
  on public.attendance_logs for update
  to authenticated
  using     (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Update: branch managers update status / notes in their branch
create policy "branch managers can update branch attendance"
  on public.attendance_logs for update
  to authenticated
  using     (public.user_branch_role_level(branch_id) <= 3)
  with check (public.user_branch_role_level(branch_id) <= 3);

-- Update: admins update anything
create policy "admins can update all attendance"
  on public.attendance_logs for update
  to authenticated
  using     (public.is_admin())
  with check (public.is_admin());

-- Delete: admins only
create policy "admins can delete attendance"
  on public.attendance_logs for delete
  to authenticated
  using (public.is_admin());
