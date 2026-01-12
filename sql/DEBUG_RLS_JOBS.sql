-- DIAGNOSTIC: Check RLS policies on jobs table
-- Run this in Supabase SQL Editor

-- 1. Check if RLS is enabled on jobs
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'jobs';

-- 2. List all RLS policies on jobs
SELECT 
  policyname, 
  cmd as operation, 
  qual as "using_expression",
  with_check as "with_check_expression"
FROM pg_policies 
WHERE tablename = 'jobs';

-- 3. Quick count test (bypasses RLS as superuser)
SELECT COUNT(*) as total_jobs FROM jobs;

-- 4. Check if there are any jobs for this specific user
SELECT COUNT(*) as poster_job_count 
FROM jobs 
WHERE poster_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859';
