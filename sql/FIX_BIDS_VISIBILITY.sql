-- FIX BIDS VISIBILITY FOR POSTERS
-- Run this in Supabase SQL Editor to allow posters to see bids on their jobs

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Posters can view bids on own jobs" ON bids;
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;

-- 3. Policy: Workers can view their own bids
CREATE POLICY "Workers can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid());

-- 4. Policy: Posters can view ALL bids on jobs they posted
-- This uses a subquery to check if the current user is the poster of the job
CREATE POLICY "Posters can view bids on own jobs"
  ON bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = bids.job_id
      AND jobs.poster_id = auth.uid()
    )
  );

COMMIT;
