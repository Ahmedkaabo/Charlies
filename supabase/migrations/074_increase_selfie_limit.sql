-- Increase selfie file size limit to 20MB (20971520 bytes) to accommodate modern high-res phone cameras
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'attendance-selfies';
