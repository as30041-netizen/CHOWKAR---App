-- ============================================
-- FIX BIDS RLS v2: PREVENT CONCURRENT BIDDING ON CLOSED JOBS
-- ============================================

-- Enable RLS (just in case)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Drop the old insert policy
DROP POLICY IF EXISTS "Users can insert bids" ON bids;

-- Create stricter policy
CREATE POLICY "Users can insert bids"
ON bids FOR INSERT
WITH CHECK (
  auth.uid() = worker_id -- Must be creating bid for self
  AND
  NOT EXISTS ( -- CANNOT bid on own job
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_id 
    AND jobs.poster_id = auth.uid()
  )
  AND
  EXISTS ( -- CRITICAL FIX: Job MUST be OPEN
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_id 
    AND status = 'OPEN'
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ Bids RLS updated: Workers can now ONLY bid on OPEN jobs.';
END $$;
