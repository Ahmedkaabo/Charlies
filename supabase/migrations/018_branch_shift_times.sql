-- ============================================================
-- 018_branch_shift_times.sql  (spec: 006_branch_shift_times)
-- Adds shift time settings to the branches table.
-- ============================================================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS shift_start              time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS shift_end                time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS checkin_window_minutes   int  NOT NULL DEFAULT 15;

-- checkin_window_minutes: staff may check in up to N minutes before or after shift_start
