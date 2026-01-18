-- EMERGENCY FIX: Simplify RLS to unblock queries
-- The complex "Workers can view jobs they bid on" policy might be causing circular RLS checks

BEGIN;

-- Drop ALL existing SELECT policies
DROP POLICY IF EXISTS "Anyone can view open jobs" ON jobs;
DROP POLICY IF EXISTS "Posters can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Workers can view jobs they bid on" ON jobs;

-- Create ONE simple, permissive SELECT policy
-- All authenticated users can read all jobs (filtering is done in the application)
CREATE POLICY "Authenticated users can read all jobs"
ON jobs FOR SELECT
TO authenticated
USING (true);

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'jobs' ORDER BY cmd, policyname;

COMMIT;
