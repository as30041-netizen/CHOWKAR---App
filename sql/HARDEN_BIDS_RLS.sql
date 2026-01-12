-- ===================================================
-- HARDEN BIDS RLS (SECURITY FIX)
-- Replaces permissive policies with strict ownership
-- ===================================================

BEGIN;

-- 1. CLEANUP: Remove all permissive or legacy policies
DROP POLICY IF EXISTS "Anyone can read bids" ON bids;
DROP POLICY IF EXISTS "Workers can update own bids" ON bids;
DROP POLICY IF EXISTS "Authenticated users can read bids" ON bids;
DROP POLICY IF EXISTS "Poster can update bids on their jobs" ON bids;
DROP POLICY IF EXISTS "Update Bids" ON bids;
DROP POLICY IF EXISTS "policy_bids_select" ON bids;
DROP POLICY IF EXISTS "bids_select_policy" ON bids;
DROP POLICY IF EXISTS "bids_insert_policy" ON bids;
DROP POLICY IF EXISTS "bids_update_policy" ON bids;
DROP POLICY IF EXISTS "bids_delete_policy" ON bids;

-- NEWLY IDENTIFIED LEGACY POLICIES (From screenshot)
DROP POLICY IF EXISTS "Delete Bids" ON bids;
DROP POLICY IF EXISTS "Insert Bids" ON bids;
DROP POLICY IF EXISTS "View Bids" ON bids;
DROP POLICY IF EXISTS "Workers can create bids" ON bids;
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;

-- 2. SELECT: Bids are visible to:
--    a) The worker who placed the bid
--    b) The poster who owns the job the bid is for
CREATE POLICY "bids_select_policy"
ON bids FOR SELECT
TO authenticated
USING (
    worker_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
);

-- 3. INSERT: Anyone authenticated can place a bid, but only for themselves
CREATE POLICY "bids_insert_policy"
ON bids FOR INSERT
TO authenticated
WITH CHECK (
    worker_id = auth.uid()
);

-- 4. UPDATE: 
--    a) Workers can update their own bids (change amount/message)
--    b) Posters can update bids on their jobs (change status to ACCEPTED/REJECTED or send counter)
CREATE POLICY "bids_update_policy"
ON bids FOR UPDATE
TO authenticated
USING (
    worker_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
)
WITH CHECK (
    worker_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
);

-- 5. DELETE: Only the worker can withdraw their bid
CREATE POLICY "bids_delete_policy"
ON bids FOR DELETE
TO authenticated
USING (worker_id = auth.uid());

-- 6. VERIFY: Show resulting policies
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'bids' ORDER BY cmd, policyname;

COMMIT;
