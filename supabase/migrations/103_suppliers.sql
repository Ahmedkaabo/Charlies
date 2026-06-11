-- 103_suppliers.sql
--
-- Adds a suppliers module:
--   • public.suppliers          – per-account supplier records
--   • public.category_suppliers – many-to-many link between categories and suppliers
--   • expenses.supplier_id      – optional supplier on each expense
-- ============================================================

-- ── 1. suppliers ─────────────────────────────────────────────

create table public.suppliers (
  id             uuid        primary key default gen_random_uuid(),
  account_id     uuid        not null references public.accounts(id) on delete cascade,
  name           text        not null,
  contact_person text,
  phone          text,
  email          text,
  notes          text,
  created_at     timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "account members can read suppliers"
  on public.suppliers for select
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = auth.uid())
  );

create policy "admins can insert suppliers"
  on public.suppliers for insert
  to authenticated
  with check (
    account_id = (select account_id from public.profiles where id = auth.uid())
    and public.is_admin()
  );

create policy "admins can update suppliers"
  on public.suppliers for update
  to authenticated
  using     (account_id = (select account_id from public.profiles where id = auth.uid()) and public.is_admin())
  with check (account_id = (select account_id from public.profiles where id = auth.uid()) and public.is_admin());

create policy "admins can delete suppliers"
  on public.suppliers for delete
  to authenticated
  using (
    account_id = (select account_id from public.profiles where id = auth.uid())
    and public.is_admin()
  );

-- ── 2. category_suppliers ─────────────────────────────────────

create table public.category_suppliers (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  unique (category_id, supplier_id)
);

alter table public.category_suppliers enable row level security;

create policy "authenticated can read category_suppliers"
  on public.category_suppliers for select
  to authenticated
  using (true);

create policy "admins can insert category_suppliers"
  on public.category_suppliers for insert
  to authenticated
  with check (public.is_admin());

create policy "admins can delete category_suppliers"
  on public.category_suppliers for delete
  to authenticated
  using (public.is_admin());

-- ── 3. expenses.supplier_id ───────────────────────────────────

alter table public.expenses
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
