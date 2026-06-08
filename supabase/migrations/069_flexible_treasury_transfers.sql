-- ============================================================
-- 069_flexible_treasury_transfers.sql
-- Expand treasury_transfers to support flexible source and
-- destination pools (sales, expenses, treasury).
-- ============================================================

-- Add source and destination columns
ALTER TABLE public.treasury_transfers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'sales' CHECK (source IN ('sales', 'expenses', 'treasury'));
ALTER TABLE public.treasury_transfers ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT 'treasury' CHECK (destination IN ('sales', 'expenses', 'treasury'));

-- Update existing records to reflect the implicit behavior
-- (Existing records were always from sales to treasury)
UPDATE public.treasury_transfers SET source = 'sales', destination = 'treasury' WHERE source IS NULL OR destination IS NULL;
