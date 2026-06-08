-- ============================================================
-- 041_sales_receipt.sql
-- Add receipt_url to sales_records.
-- ============================================================

ALTER TABLE public.sales_records
  ADD COLUMN IF NOT EXISTS receipt_url text;
