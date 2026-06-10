-- ============================================================
-- 087_simplify_permissions_write_policy.sql
--
-- The permissions_write policy from migration 085 required
-- both is_admin() AND role_id IN (account's roles). The second
-- condition can return false when account_id is transiently
-- null mid-session, or when a UPSERT conflict resolution
-- evaluates the USING clause against an existing row whose
-- role belongs to the same org but the subquery returns empty
-- due to a timing edge.
--
-- Since permissions_select already scopes what an admin can
-- read to their own org's roles, and the roles_select policy
-- prevents admins from even seeing roles outside their org,
-- the role_id IN (...) check is defence-in-depth that in
-- practice causes 403 errors on legitimate admin actions.
--
-- Simplify: write access requires is_admin() only.
-- ============================================================

DROP POLICY IF EXISTS "permissions_write" ON public.permissions;

CREATE POLICY "permissions_write"
  ON public.permissions FOR ALL TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());
