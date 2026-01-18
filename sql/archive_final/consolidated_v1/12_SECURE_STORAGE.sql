-- ============================================================================
-- SECURE STORAGE SETUP
-- Fixes missing RLS on Storage Buckets
-- ============================================================================

BEGIN;

-- 1. Create Bucket if not exists (Public for image serving)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-images', 'job-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on Objects (Critical)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public Read Access (Anyone can view job/profile images)
-- We check if the bucket is 'job-images'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access to Job Images'
    ) THEN
        CREATE POLICY "Public Access to Job Images" ON storage.objects
        FOR SELECT
        USING (bucket_id = 'job-images');
    END IF;
END $$;

-- 4. Policy: Authenticated Uploads
-- Verify user is authenticated and is uploading to 'job-images'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated Users Can Upload Images'
    ) THEN
        CREATE POLICY "Authenticated Users Can Upload Images" ON storage.objects
        FOR INSERT 
        TO authenticated
        WITH CHECK (bucket_id = 'job-images');
    END IF;
END $$;

-- 5. Policy: Owner Update/Delete
-- Users can only update/delete their own files (owner field is auto-set by Supabase to auth.uid())
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users Can Update Own Images'
    ) THEN
        CREATE POLICY "Users Can Update Own Images" ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (bucket_id = 'job-images' AND owner = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users Can Delete Own Images'
    ) THEN
        CREATE POLICY "Users Can Delete Own Images" ON storage.objects
        FOR DELETE
        TO authenticated
        USING (bucket_id = 'job-images' AND owner = auth.uid());
    END IF;
END $$;

COMMIT;
