-- ============================================================
-- 076_fix_selfie_rls.sql
-- Simplifies the folder check to be more robust.
-- Some environments have issues with the foldername array indexing.
-- ============================================================

DROP POLICY IF EXISTS "users can upload own attendance selfies" ON storage.objects;
DROP POLICY IF EXISTS "users can update own attendance selfies" ON storage.objects;
DROP POLICY IF EXISTS "users can delete own attendance selfies" ON storage.objects;

CREATE POLICY "users can upload own attendance selfies"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users can update own attendance selfies"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users can delete own attendance selfies"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Also add a policy for ALL actions just in case there's a conflict
-- using a simpler string match
CREATE POLICY "users can manage own folder"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND name LIKE auth.uid()::text || '/%'
  )
  WITH CHECK (
    bucket_id = 'attendance-selfies'
    AND name LIKE auth.uid()::text || '/%'
  );
