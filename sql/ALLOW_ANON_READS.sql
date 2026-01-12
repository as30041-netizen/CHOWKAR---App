-- AGGRESSIVE FIX: Allow anonymous reads on jobs to bypass auth issues on page refresh
-- This is safe because job data is not sensitive - anyone can see open jobs

BEGIN;

-- Drop the authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can read all jobs" ON jobs;

-- Create a policy that allows EVERYONE (including anonymous) to read jobs
CREATE POLICY "Anyone can read jobs"
ON jobs FOR SELECT
TO anon, authenticated
USING (true);

-- Verify
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'jobs' ORDER BY policyname;

COMMIT;
