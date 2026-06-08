-- ============================================================
-- 073_selfie_delete_policy.sql
-- Adds DELETE policy on attendance-selfies so staff can
-- overwrite their own selfie (e.g. re-check-in same day).
-- ============================================================

CREATE POLICY "users can delete own attendance selfies"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attendance-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
