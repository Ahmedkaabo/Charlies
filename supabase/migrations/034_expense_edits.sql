-- ============================================================
-- 034_expense_edits.sql
-- Adds edit-tracking columns to expenses and a full audit log.
-- ============================================================

-- Track when and who last edited an expense
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Audit log: one row per edit with a human-readable field diff
CREATE TABLE IF NOT EXISTS public.expense_edits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  edited_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at   timestamptz NOT NULL DEFAULT now(),
  -- { "Amount": { "from": "EGP 100.00", "to": "EGP 150.00" }, ... }
  changes     jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_edits_expense ON public.expense_edits (expense_id);

ALTER TABLE public.expense_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_edits_select" ON public.expense_edits
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND public.user_branch_role_level(e.branch_id) IS NOT NULL
    )
  );

CREATE POLICY "expense_edits_insert" ON public.expense_edits
  FOR INSERT TO authenticated
  WITH CHECK (edited_by = auth.uid());
