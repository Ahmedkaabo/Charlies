-- Drop min_hours_required from branch_shifts.
-- Day value is now binary: below full_day_hours = 0, at/above = 1.0, overtime = 1.5.
ALTER TABLE public.branch_shifts DROP COLUMN IF EXISTS min_hours_required;
