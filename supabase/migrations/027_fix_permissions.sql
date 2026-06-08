-- ============================================================
-- 027_fix_permissions.sql
-- 1. Rename legacy 'staff' resource → 'members' in all existing rows
-- 2. Seed missing resource permissions for every role
-- ============================================================

-- ── 1. Remove legacy 'staff' permission rows ─────────────────
-- 'members' rows already exist from later migrations; the old
-- 'staff' rows are dead weight that can be safely dropped.

DELETE FROM public.permissions WHERE resource = 'staff';

-- ── 2. Seed full matrix for all current roles & resources ────
-- Uses INSERT ... ON CONFLICT DO NOTHING so existing custom
-- values set via the UI are never overwritten.

DO $$
DECLARE
  v_admins         uuid;
  v_area_manager   uuid;
  v_branch_manager uuid;
  v_bar            uuid;
BEGIN
  SELECT id INTO v_admins         FROM public.roles WHERE name = 'Admins';
  SELECT id INTO v_area_manager   FROM public.roles WHERE name = 'area_manager';
  SELECT id INTO v_branch_manager FROM public.roles WHERE name = 'branch_manager';
  SELECT id INTO v_bar            FROM public.roles WHERE name = 'bar';

  INSERT INTO public.permissions
    (role_id, resource, can_create, can_read, can_update, can_delete)
  VALUES
    -- ── Admins: full access on all resources ──────────────────
    (v_admins, 'branches',   true,  true,  true,  true),
    (v_admins, 'members',    true,  true,  true,  true),
    (v_admins, 'attendance', true,  true,  true,  true),
    (v_admins, 'payroll',    true,  true,  true,  true),
    (v_admins, 'expenses',   true,  true,  true,  true),
    (v_admins, 'settings',   true,  true,  true,  true),
    (v_admins, 'permissions',true,  true,  true,  true),
    (v_admins, 'owners',     true,  true,  true,  true),

    -- ── Area Manager ──────────────────────────────────────────
    (v_area_manager, 'branches',    true,  true,  true,  false),
    (v_area_manager, 'members',     true,  true,  true,  true),
    (v_area_manager, 'attendance',  true,  true,  true,  true),
    (v_area_manager, 'payroll',     true,  true,  true,  false),
    (v_area_manager, 'expenses',    true,  true,  true,  true),
    (v_area_manager, 'settings',    false, true,  true,  false),
    (v_area_manager, 'permissions', false, true,  false, false),
    (v_area_manager, 'owners',      false, true,  false, false),

    -- ── Branch Manager ────────────────────────────────────────
    (v_branch_manager, 'branches',    false, true,  false, false),
    (v_branch_manager, 'members',     true,  true,  true,  false),
    (v_branch_manager, 'attendance',  true,  true,  true,  true),
    (v_branch_manager, 'payroll',     false, true,  false, false),
    (v_branch_manager, 'expenses',    true,  true,  true,  false),
    (v_branch_manager, 'settings',    false, true,  false, false),
    (v_branch_manager, 'permissions', false, false, false, false),
    (v_branch_manager, 'owners',      false, false, false, false),

    -- ── Bar (operational staff) ───────────────────────────────
    (v_bar, 'branches',    false, true,  false, false),
    (v_bar, 'members',     false, false, false, false),
    (v_bar, 'attendance',  true,  true,  false, false),
    (v_bar, 'payroll',     false, true,  false, false),
    (v_bar, 'expenses',    false, false, false, false),
    (v_bar, 'settings',    false, false, false, false),
    (v_bar, 'permissions', false, false, false, false),
    (v_bar, 'owners',      false, false, false, false)

  ON CONFLICT (role_id, resource) DO NOTHING;
END;
$$;
