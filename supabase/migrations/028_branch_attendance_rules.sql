-- Add configurable attendance hour thresholds to branches.
-- min_shift_hours: hours at-or-above which counts as a full day (day_value = 1.0)
-- max_shift_hours: hours at-or-above which counts as an overtime day (day_value = 1.5)
alter table branches
  add column if not exists min_shift_hours numeric(4,1) not null default 8,
  add column if not exists max_shift_hours numeric(4,1) not null default 12;
