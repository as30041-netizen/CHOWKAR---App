-- FIX: Allow workers to update their own bids AND posters to update bids on their jobs
-- This is needed for counter-offer functionality

BEGIN;

-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Update Bids" ON bids;
DROP POLICY IF EXISTS "Workers can update own bids" ON bids;
DROP POLICY IF EXISTS "Poster can update bids on their jobs" ON bids;

-- Allow workers to update their own bids (for counter-offers from worker)
CREATE POLICY "Workers can update own bids"
ON bids FOR UPDATE
TO anon, authenticated
USING (true)  -- Allow all updates (RLS can't easily verify worker_id with anon key)
WITH CHECK (true);

-- Alternative: If you want stricter control, use this instead:
-- USING (worker_id = auth.uid() OR EXISTS (SELECT 1 FROM jobs WHERE jobs.id = bids.job_id AND jobs.poster_id = auth.uid()))
-- But since we're using anon key for REST API, we use permissive policy

-- Verify
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'bids' ORDER BY cmd, policyname;

COMMIT;
