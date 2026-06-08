-- ============================================================
-- 021_branch_members_self_update.sql
-- Allow users to upsert their own branch_members row.
-- Required so the self-enrollment upsert (onboarding + re-join)
-- can satisfy both the INSERT and UPDATE policy checks that
-- Postgres requires for ON CONFLICT DO UPDATE.
-- ============================================================

CREATE POLICY "users can update own branch membership"
  ON public.branch_members
  FOR UPDATE
  TO authenticated
  USING     (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
