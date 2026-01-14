-- LIST ALL POLICIES ON JOBS TABLE
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'jobs';
