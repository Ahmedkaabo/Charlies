-- 059_split_staff_owners.sql
-- Replace the dual-purpose branch_members table with two dedicated tables:
--   staff  → operational branch assignments (non-owners)
--   owners → owner branch assignments
-- branch_members is kept intact so existing RLS / other queries don't break,
-- but all application code moves to the new tables.

-- ── staff ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  branch_id  UUID        NOT NULL REFERENCES public.branches(id)  ON DELETE CASCADE,
  role_id    UUID                    REFERENCES public.roles(id),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_profile_branch_unique UNIQUE (profile_id, branch_id)
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select" ON public.staff
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_all"    ON public.staff
  FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ── owners ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.owners (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  branch_id  UUID        NOT NULL REFERENCES public.branches(id)  ON DELETE CASCADE,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT owners_profile_branch_unique UNIQUE (profile_id, branch_id)
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_select" ON public.owners
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "owners_all"    ON public.owners
  FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ── migrate existing branch_members data ─────────────────────

-- Operational staff (branch_members rows with non-system roles)
INSERT INTO public.staff (profile_id, branch_id, role_id, is_active, joined_at)
SELECT bm.profile_id, bm.branch_id, bm.role_id, bm.is_active, bm.joined_at
FROM   public.branch_members bm
LEFT JOIN public.roles r ON r.id = bm.role_id
WHERE  (r.is_system IS NULL OR r.is_system = FALSE)
ON CONFLICT (profile_id, branch_id) DO NOTHING;

-- Owners (branch_members rows with system roles)
INSERT INTO public.owners (profile_id, branch_id, is_active, joined_at)
SELECT DISTINCT bm.profile_id, bm.branch_id, bm.is_active, bm.joined_at
FROM   public.branch_members bm
JOIN   public.roles r ON r.id = bm.role_id
WHERE  r.is_system = TRUE
ON CONFLICT (profile_id, branch_id) DO NOTHING;

-- NOTE: ahmedkaaboo@gmail.com retains is_admin = TRUE on the profiles row.
-- That flag is the source of truth for system-admin status and is unchanged
-- by this migration. Any branch-owner rows for that account are migrated above.
