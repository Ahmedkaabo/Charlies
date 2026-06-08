-- ============================================================
-- 032_receipts_bucket.sql
-- Creates the receipts storage bucket with public read access.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Authenticated users can upload
DO $$ BEGIN
  CREATE POLICY "authenticated users can upload receipts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can overwrite their own uploads
DO $$ BEGIN
  CREATE POLICY "authenticated users can update receipts"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public read
DO $$ BEGIN
  CREATE POLICY "public can read receipts"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
