-- ============================================================================
-- AUDIT: CHECK STORAGE POLICIES
-- ============================================================================

-- 1. List Buckets
SELECT * FROM storage.buckets;

-- 2. List Policies on storage.objects
SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
