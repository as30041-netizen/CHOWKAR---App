-- FIX: Allow reads on bids table (same issue as jobs)

BEGIN;

-- Allow anyone to read bids
DROP POLICY IF EXISTS "Anyone can read bids" ON bids;
DROP POLICY IF EXISTS "Authenticated users can read bids" ON bids;
DROP POLICY IF EXISTS "policy_bids_select" ON bids;

CREATE POLICY "Anyone can read bids"
ON bids FOR SELECT
TO anon, authenticated
USING (true);

-- Verify
SELECT policyname, cmd, tablename FROM pg_policies WHERE tablename = 'bids' ORDER BY policyname;

COMMIT;
