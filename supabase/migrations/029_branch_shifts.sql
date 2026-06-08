-- ============================================================
-- 029_branch_shifts.sql
-- Extracts shift configuration into a dedicated branch_shifts table.
-- Supports multiple shifts per branch with per-shift attendance rules
-- including late-deduction penalties and minimum required hours.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_shifts (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id              uuid         NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name                   text         NOT NULL DEFAULT 'Default Shift',
  shift_start            time         NOT NULL DEFAULT '09:00',
  shift_end              time         NOT NULL DEFAULT '17:00',
  checkin_window_minutes int          NOT NULL DEFAULT 15,

  -- Attendance hour thresholds
  min_hours_required     numeric(4,1) NOT NULL DEFAULT 0,    -- below this → day_value = 0
  full_day_hours         numeric(4,1) NOT NULL DEFAULT 8,    -- ≥ this     → day_value = 1.0
  overtime_hours         numeric(4,1) NOT NULL DEFAULT 12,   -- ≥ this     → day_value = 1.5

  -- Late-penalty rule: per every N minutes late (after grace) → deduct M hours
  late_grace_minutes     int          NOT NULL DEFAULT 0,
  late_deduction_enabled boolean      NOT NULL DEFAULT false,
  late_per_minutes       int,
  late_deduct_hours      numeric(4,2),

  is_active              boolean      NOT NULL DEFAULT true,
  created_at             timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT shift_hours_order CHECK (overtime_hours > full_day_hours AND full_day_hours > 0)
);

-- Seed one default shift per branch from existing branch-level shift config
INSERT INTO public.branch_shifts (
  branch_id, name,
  shift_start, shift_end,
  checkin_window_minutes,
  full_day_hours, overtime_hours
)
SELECT
  id,
  'Default Shift',
  COALESCE(shift_start, check_in_time, '09:00'::time),
  COALESCE(shift_end,   check_out_time, '17:00'::time),
  COALESCE(checkin_window_minutes, 15),
  COALESCE(min_shift_hours, 8),
  COALESCE(max_shift_hours, 12)
FROM public.branches;

-- Link attendance logs to the shift used during that check-in
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.branch_shifts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branch_shifts_branch   ON public.branch_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shift        ON public.attendance_logs(shift_id);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.branch_shifts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read shifts
CREATE POLICY "branch_shifts_read" ON public.branch_shifts
  FOR SELECT TO authenticated
  USING (true);

-- Admins or branch/area managers (level ≤ 2) can write shifts
CREATE POLICY "branch_shifts_write" ON public.branch_shifts
  FOR ALL TO authenticated
  USING     (public.is_admin() OR public.user_branch_role_level(branch_id) <= 2)
  WITH CHECK (public.is_admin() OR public.user_branch_role_level(branch_id) <= 2);
