-- Migration 082 added correct RLS policies for expenses but the DROP
-- statements used wrong names, so the old broken policies (using the
-- deprecated user_branch_role_level() function) were never removed.
-- Drop them here by their actual names.

DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
