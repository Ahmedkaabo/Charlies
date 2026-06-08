-- ============================================================
-- 005_attendance_updates.sql
-- Attendance & Payroll schema additions
-- ============================================================

-- ── 1. Extend attendance_logs ─────────────────────────────────

ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS early_minutes int NOT NULL DEFAULT 0;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS late_minutes int NOT NULL DEFAULT 0;
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS total_hours numeric(5,2);
-- day_value: 1.5 for 12+hrs, 1.0 for 8–10hrs, 0.5 for under 8hrs
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS day_value numeric(3,2);

-- ── 2. Extend branches with shift times ───────────────────────
-- check_in_time / check_out_time stored as TIME (HH:MM:SS)

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS check_in_time  time;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS check_out_time time;

-- ── 3. payroll_records ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid          REFERENCES public.branches(id)  ON DELETE CASCADE,
  profile_id       uuid          REFERENCES public.profiles(id)  ON DELETE CASCADE,
  month            int           NOT NULL,
  year             int           NOT NULL,
  base_salary      numeric(10,2),
  total_bonuses    numeric(10,2) NOT NULL DEFAULT 0,
  total_deductions numeric(10,2) NOT NULL DEFAULT 0,
  total_debts      numeric(10,2) NOT NULL DEFAULT 0,
  days_present     numeric(6,2)  NOT NULL DEFAULT 0,
  net_salary       numeric(10,2),
  currency         text          NOT NULL DEFAULT 'EGP',
  is_finalized     boolean       NOT NULL DEFAULT false,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (branch_id, profile_id, month, year)
);

-- ── 4. payroll_adjustments ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id uuid          REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  branch_id         uuid          REFERENCES public.branches(id)        ON DELETE CASCADE,
  profile_id        uuid          REFERENCES public.profiles(id)        ON DELETE CASCADE,
  type              text          NOT NULL CHECK (type IN ('bonus', 'deduction', 'debt')),
  amount            numeric(10,2) NOT NULL,
  reason            text,
  month             int           NOT NULL,
  year              int           NOT NULL,
  created_by        uuid          REFERENCES public.profiles(id),
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- ── 5. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payroll_records_branch_month
  ON public.payroll_records (branch_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_records_profile
  ON public.payroll_records (profile_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_adj_record
  ON public.payroll_adjustments (payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adj_profile
  ON public.payroll_adjustments (profile_id, month, year);

-- ── 6. Enable RLS ─────────────────────────────────────────────

ALTER TABLE public.payroll_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- ── 7. Policies: payroll_records ──────────────────────────────

-- Admins: full access
CREATE POLICY "admins can manage payroll records"
  ON public.payroll_records
  FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Area managers / branch managers (level ≤ 2) can read their branch payroll
CREATE POLICY "managers can read branch payroll"
  ON public.payroll_records
  FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) <= 2);

-- Area managers / branch managers can create payroll records
CREATE POLICY "managers can insert branch payroll"
  ON public.payroll_records
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) <= 2);

-- Area managers / branch managers can update their branch payroll
CREATE POLICY "managers can update branch payroll"
  ON public.payroll_records
  FOR UPDATE
  TO authenticated
  USING     (public.user_branch_role_level(branch_id) <= 2)
  WITH CHECK (public.user_branch_role_level(branch_id) <= 2);

-- Staff can read their own payroll record
CREATE POLICY "staff can read own payroll"
  ON public.payroll_records
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ── 8. Policies: payroll_adjustments ─────────────────────────

-- Admins: full access
CREATE POLICY "admins can manage payroll adjustments"
  ON public.payroll_adjustments
  FOR ALL
  TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- Managers can insert adjustments for their branch
CREATE POLICY "managers can insert adjustments"
  ON public.payroll_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_branch_role_level(branch_id) <= 2);

-- Managers can read adjustments in their branch
CREATE POLICY "managers can read branch adjustments"
  ON public.payroll_adjustments
  FOR SELECT
  TO authenticated
  USING (public.user_branch_role_level(branch_id) <= 2);

-- Staff can read their own adjustments
CREATE POLICY "staff can read own adjustments"
  ON public.payroll_adjustments
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ── 9. Storage bucket ─────────────────────────────────────────
-- Create "attendance-selfies" bucket in Supabase Storage dashboard
-- (public read, authenticated write, max 5 MB per file).
-- RLS on storage.objects can be added via the dashboard.
