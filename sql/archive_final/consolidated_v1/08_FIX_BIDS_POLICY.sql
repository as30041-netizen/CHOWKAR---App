-- ============================================================================
-- FIX BIDS RLS POLICY
-- Ensures Posters can view bids on their own jobs
-- ============================================================================

BEGIN;

-- 1. DROP EXISTING POLICIES (to be safe)
DROP POLICY IF EXISTS "Posters can view bids on their jobs" ON bids;
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;
DROP POLICY IF EXISTS "Workers can create bids" ON bids;
DROP POLICY IF EXISTS "Workers can update own bids" ON bids;
DROP POLICY IF EXISTS "Users can view bids on their jobs" ON bids; -- Cleanup old name

-- 2. RECREATE POLICIES

-- A. Workers can see their own bids
CREATE POLICY "Workers can view own bids" ON bids
FOR SELECT USING (auth.uid() = worker_id);

-- B. Posters can see ALL bids for their jobs (Optimized)
-- We use a direct EXISTS check which is often faster/safer than IN
CREATE POLICY "Posters can view bids on their jobs" ON bids
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
);

-- C. Workers can Create
CREATE POLICY "Workers can create bids" ON bids
FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);

-- D. Workers can Update (e.g. negotiation)
CREATE POLICY "Workers can update own bids" ON bids
FOR UPDATE TO authenticated USING (auth.uid() = worker_id);

-- E. Posters can Update (e.g. Reject/Accept status)
CREATE POLICY "Posters can update bids on their jobs" ON bids
FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = bids.job_id 
        AND jobs.poster_id = auth.uid()
    )
);

COMMIT;
