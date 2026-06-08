-- ============================================================
-- 047_reset_permissions_and_categories.sql
-- Hard-resets permissions and expense_categories to their
-- canonical latest state, matching the current roles schema
-- (Owner/area_manager/branch_manager/bar/service) and the
-- resource keys the frontend actually uses.
-- ============================================================

-- ── 1. Expense categories ─────────────────────────────────────

truncate table public.expense_categories cascade;

insert into public.expense_categories (name, icon) values
  ('Supplies',         'package'),
  ('Utilities',        'zap'),
  ('Employee Debt',    'banknote'),
  ('Maintenance',      'wrench'),
  ('Equipment',        'cpu'),
  ('Food & Beverages', 'utensils'),
  ('Transport',        'truck'),
  ('Cleaning',         'sparkles'),
  ('Internet',         'wifi'),
  ('Other',            'more-horizontal');

-- ── 2. Permissions ────────────────────────────────────────────

truncate table public.permissions cascade;

do $$
declare
  v_owner          uuid;
  v_area_manager   uuid;
  v_branch_manager uuid;
  v_bar            uuid;
  v_service        uuid;
begin
  select id into v_owner          from public.roles where name = 'Owner';
  select id into v_area_manager   from public.roles where name = 'area_manager';
  select id into v_branch_manager from public.roles where name = 'branch_manager';
  select id into v_bar            from public.roles where name = 'bar';
  select id into v_service        from public.roles where name = 'service';

  insert into public.permissions
    (role_id, resource, can_create, can_read, can_update, can_delete)
  values

    -- ── Owner: full access on everything ─────────────────────
    (v_owner, 'branches',    true,  true,  true,  true),
    (v_owner, 'staff',       true,  true,  true,  true),
    (v_owner, 'checkin',     true,  true,  true,  true),
    (v_owner, 'attendance',  true,  true,  true,  true),
    (v_owner, 'payroll',     true,  true,  true,  true),
    (v_owner, 'expenses',    true,  true,  true,  true),
    (v_owner, 'sales',       true,  true,  true,  true),
    (v_owner, 'finance',     true,  true,  true,  true),
    (v_owner, 'settings',    true,  true,  true,  true),
    (v_owner, 'permissions', true,  true,  true,  true),
    (v_owner, 'owners',      true,  true,  true,  true),

    -- ── Area Manager ──────────────────────────────────────────
    (v_area_manager, 'branches',    true,  true,  true,  false),
    (v_area_manager, 'staff',       true,  true,  true,  true),
    (v_area_manager, 'checkin',     true,  true,  true,  true),
    (v_area_manager, 'attendance',  true,  true,  true,  true),
    (v_area_manager, 'payroll',     true,  true,  true,  false),
    (v_area_manager, 'expenses',    true,  true,  true,  true),
    (v_area_manager, 'sales',       true,  true,  true,  false),
    (v_area_manager, 'finance',     true,  true,  true,  true),
    (v_area_manager, 'settings',    false, true,  true,  false),
    (v_area_manager, 'permissions', false, true,  false, false),
    (v_area_manager, 'owners',      false, true,  false, false),

    -- ── Branch Manager ────────────────────────────────────────
    (v_branch_manager, 'branches',    false, true,  false, false),
    (v_branch_manager, 'staff',       true,  true,  true,  false),
    (v_branch_manager, 'checkin',     true,  true,  true,  true),
    (v_branch_manager, 'attendance',  true,  true,  true,  true),
    (v_branch_manager, 'payroll',     false, true,  false, false),
    (v_branch_manager, 'expenses',    true,  true,  true,  false),
    (v_branch_manager, 'sales',       true,  true,  true,  false),
    (v_branch_manager, 'finance',     true,  true,  true,  false),
    (v_branch_manager, 'settings',    false, true,  false, false),
    (v_branch_manager, 'permissions', false, false, false, false),
    (v_branch_manager, 'owners',      false, false, false, false),

    -- ── Bar (operational) ─────────────────────────────────────
    (v_bar, 'branches',    false, true,  false, false),
    (v_bar, 'staff',       false, false, false, false),
    (v_bar, 'checkin',     true,  true,  false, false),
    (v_bar, 'attendance',  true,  true,  false, false),
    (v_bar, 'payroll',     false, true,  false, false),
    (v_bar, 'expenses',    false, false, false, false),
    (v_bar, 'sales',       true,  true,  false, false),
    (v_bar, 'finance',     false, true,  false, false),
    (v_bar, 'settings',    false, false, false, false),
    (v_bar, 'permissions', false, false, false, false),
    (v_bar, 'owners',      false, false, false, false),

    -- ── Service (operational) ─────────────────────────────────
    (v_service, 'branches',    false, true,  false, false),
    (v_service, 'staff',       false, true,  false, false),
    (v_service, 'checkin',     true,  true,  false, false),
    (v_service, 'attendance',  true,  true,  false, false),
    (v_service, 'payroll',     false, false, false, false),
    (v_service, 'expenses',    false, true,  false, false),
    (v_service, 'sales',       true,  true,  false, false),
    (v_service, 'finance',     false, false, false, false),
    (v_service, 'settings',    false, false, false, false),
    (v_service, 'permissions', false, false, false, false),
    (v_service, 'owners',      false, false, false, false);

end;
$$;
