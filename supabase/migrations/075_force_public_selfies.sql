-- ============================================================
-- 074_force_public_selfies.sql
-- Ensures the attendance-selfies bucket is public.
-- If it was created as private, ON CONFLICT DO NOTHING
-- would have left it private.
-- ============================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'attendance-selfies';
