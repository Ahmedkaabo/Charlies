-- ============================================================
-- 017_attendance_selfies_bucket.sql
-- Creates the attendance-selfies storage bucket with RLS
-- ============================================================

-- Create the bucket (public so selfie thumbnails can be displayed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attendance-selfies',
  'attendance-selfies',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Staff can upload into their own folder (path starts with their profile id)
CREATE POLICY "users can upload own attendance selfies"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff can update (overwrite) their own selfies
CREATE POLICY "users can update own attendance selfies"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is public, but explicit policy is good practice)
CREATE POLICY "public can read attendance selfies"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'attendance-selfies');
