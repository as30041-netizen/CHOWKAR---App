-- =====================================================
-- CHOWKAR - Create Storage Bucket for Job Images
-- =====================================================
-- Run this in Supabase SQL Editor
-- This creates a public bucket for storing job images
-- =====================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'job-images',
    'job-images',
    true,  -- Public bucket for easy access
    5242880,  -- 5MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- =====================================================
-- Storage Policies
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view job images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload job images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own job images" ON storage.objects;

-- Policy: Anyone can view job images (public read)
CREATE POLICY "Anyone can view job images"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-images');

-- Policy: Authenticated users can upload job images
CREATE POLICY "Authenticated users can upload job images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-images');

-- Policy: Authenticated users can update their images
CREATE POLICY "Authenticated users can update job images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'job-images')
WITH CHECK (bucket_id = 'job-images');

-- Policy: Authenticated users can delete job images
CREATE POLICY "Authenticated users can delete job images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-images');

-- =====================================================
-- Verification
-- =====================================================
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'job-images';

SELECT 
    policyname,
    cmd as command
FROM pg_policies
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%job images%';
