-- ============================================================================
-- SECURE BIDS RLS
-- Enforce strict visibility:
-- 1. Workers see ONLY their own bids.
-- 2. Posters see ALL bids for their jobs.
-- 3. Updates allowed only for own bids (Worker) or acceptance (Poster via RPC).
-- ============================================================================

BEGIN;

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 1. DROP EXISTING POLICIES (Clean Slate)
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;
DROP POLICY IF EXISTS "Posters can view bids on their jobs" ON bids;
DROP POLICY IF EXISTS "Users can create bids" ON bids; -- Handled by RPC
DROP POLICY IF EXISTS "Workers can update own bids" ON bids;

-- 2. SELECT POLICIES
-- A. Worker sees own bids
CREATE POLICY "Workers can view own bids" ON bids
FOR SELECT
USING (auth.uid() = worker_id);

-- B. Poster sees bids for their jobs
-- Optimized using EXISTS to avoid JOIN if possible, or direct check if job structure allows
CREATE POLICY "Posters can view bids on their jobs" ON bids
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
);

-- 3. INSERT POLICY
-- Strictly blocked by default. We use RPC `action_place_bid` (SECURITY DEFINER)
-- But for Realtime to work on 'INSERT', the user might need RLS visibility of the *result* row?
-- Actually, Realtime respects the SELECT policy for the *new* row.
-- If I insert via RPC, the RPC owns the insert.
-- The *Subscription* checks if the subscriber can SELECT the new row.
-- So we generally don't need an INSERT policy if we only use RPCs.
-- However, if we ever switch to client-side insert:
-- CREATE POLICY "Workers can insert own bids" ON bids FOR INSERT WITH CHECK (auth.uid() = worker_id);
-- Keeping it disabled for now to force RPC usage (Coin Deduction).

-- 4. UPDATE POLICY
-- Worker can update message/amount of PENDING bid
CREATE POLICY "Workers can update own pending bids" ON bids
FOR UPDATE
USING (auth.uid() = worker_id AND status = 'PENDING')
WITH CHECK (auth.uid() = worker_id AND status = 'PENDING');

-- Poster can update status (Accept/Reject) - Actually handled by RPC `action_accept_bid`
-- But if we want to allow "Reject" via UI directly:
CREATE POLICY "Posters can update bid status" ON bids
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
);

-- 5. DELETE POLICY
-- Worker can withdraw PENDING bid
CREATE POLICY "Workers can delete own pending bids" ON bids
FOR DELETE
USING (auth.uid() = worker_id AND status = 'PENDING');

COMMIT;
