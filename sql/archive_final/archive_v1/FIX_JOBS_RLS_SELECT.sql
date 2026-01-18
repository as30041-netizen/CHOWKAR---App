-- FIX: Allow authenticated users to read jobs
-- This fixes the issue where RLS blocks legitimate SELECT queries

BEGIN;

-- 1. Drop any existing overly restrictive policies
DROP POLICY IF EXISTS "Users can view open jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can read jobs" ON jobs;
DROP POLICY IF EXISTS "Everyone can view open jobs" ON jobs;
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
DROP POLICY IF EXISTS "Enable read access for all users" ON jobs;

-- 2. Create permissive SELECT policies
-- Policy 1: Anyone can view OPEN jobs (for workers browsing)
CREATE POLICY "Anyone can view open jobs"
ON jobs FOR SELECT
USING (status = 'OPEN');

-- Policy 2: Job posters can always view their own jobs (any status)
CREATE POLICY "Posters can view their own jobs"
ON jobs FOR SELECT
USING (poster_id = auth.uid());

-- Policy 3: Workers can view jobs they have bid on (any status)
CREATE POLICY "Workers can view jobs they bid on"
ON jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bids 
    WHERE bids.job_id = jobs.id 
    AND bids.worker_id = auth.uid()
  )
);

-- 3. Verify policies were created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'jobs' ORDER BY policyname;

COMMIT;
