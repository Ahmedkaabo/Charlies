-- ============================================================
-- 088_staff_account_id_sync.sql
--
-- Problem: when an admin creates a staff/owner record, the new
-- user's profiles.account_id is left null. Every account-scoped
-- RLS policy (branches, roles, permissions, staff itself) then
-- returns empty for that user, so staff see no modules after
-- login.
--
-- Root cause: handle_new_user trigger only sets id/name/phone/
-- email. account_id is only populated for org owners (via
-- create_organization RPC) or invited users (client-side UPDATE
-- in signUp). Admin-created staff members fall through both.
--
-- Fixes:
--   1. Trigger on staff/owners INSERT → sync profiles.account_id
--      (SECURITY DEFINER so it can bypass profile RLS).
--   2. Backfill existing staff whose profile.account_id is null.
--   3. Self-lookup escape hatch on staff_select / owners_select
--      so fetchBranchRoles can always read the caller's own rows
--      even during any edge-case timing gap.
-- ============================================================


-- ── 1. Trigger: sync profiles.account_id on staff/owner INSERT ─

CREATE OR REPLACE FUNCTION public.sync_profile_account_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set — never overwrite an account_id already present.
  UPDATE public.profiles
  SET account_id = NEW.account_id
  WHERE id          = NEW.profile_id
    AND account_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_staff_inserted ON public.staff;
DROP TRIGGER IF EXISTS on_owner_inserted ON public.owners;

CREATE TRIGGER on_staff_inserted
  AFTER INSERT ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_account_id();

CREATE TRIGGER on_owner_inserted
  AFTER INSERT ON public.owners
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_account_id();


-- ── 2. Backfill existing staff ────────────────────────────────

UPDATE public.profiles p
SET account_id = s.account_id
FROM public.staff s
WHERE s.profile_id    = p.id
  AND p.account_id   IS NULL
  AND s.account_id   IS NOT NULL
  AND s.is_active     = true;

-- Then from owners (catches any remaining nulls)
UPDATE public.profiles p
SET account_id = o.account_id
FROM public.owners o
WHERE o.profile_id    = p.id
  AND p.account_id   IS NULL
  AND o.account_id   IS NOT NULL
  AND o.is_active     = true;


-- ── 3. Self-lookup escape hatch on staff_select ───────────────
-- Allows fetchBranchRoles to always read the caller's own rows
-- via profile_id = auth.uid(), independent of account_id.

DROP POLICY IF EXISTS "staff_select" ON public.staff;

CREATE POLICY "staff_select"
  ON public.staff FOR SELECT TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    OR profile_id = auth.uid()
  );


-- ── 4. Self-lookup escape hatch on owners_select ─────────────

DROP POLICY IF EXISTS "owners_select" ON public.owners;

CREATE POLICY "owners_select"
  ON public.owners FOR SELECT TO authenticated
  USING (
    account_id = (SELECT account_id FROM public.profiles WHERE id = auth.uid())
    OR profile_id = auth.uid()
  );


-- ── 5. Reload PostgREST schema cache ─────────────────────────
NOTIFY pgrst, 'reload schema';
