-- Enable RLS on bids table (ensure it is on)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 1. Policy: Allow users to view bids for jobs they posted OR bids they created
DROP POLICY IF EXISTS "Users can view bids for their jobs or their own bids" ON bids;
CREATE POLICY "Users can view bids for their jobs or their own bids"
ON bids FOR SELECT
USING (
  auth.uid() = worker_id -- Worker sees their own bid
  OR 
  EXISTS ( -- Poster sees bids on their job
    SELECT 1 FROM jobs 
    WHERE jobs.id = bids.job_id 
    AND jobs.poster_id = auth.uid()
  )
);

-- 2. Policy: Allow authenticated users to INSERT bids
-- (Crucial: Must not be the job poster!)
DROP POLICY IF EXISTS "Users can insert bids" ON bids;
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
);

-- 3. Policy: Allow workers to update their own bids (amount/message)
DROP POLICY IF EXISTS "Workers can update their own bids" ON bids;
CREATE POLICY "Workers can update their own bids"
ON bids FOR UPDATE
USING (auth.uid() = worker_id);

-- 4. Policy: Allow posters to delete (reject) bids or workers to delete (withdraw)
DROP POLICY IF EXISTS "Users can delete relevant bids" ON bids;
CREATE POLICY "Users can delete relevant bids"
ON bids FOR DELETE
USING (
  auth.uid() = worker_id -- Worker withdraws
  OR
  EXISTS ( -- Poster rejects
    SELECT 1 FROM jobs 
    WHERE jobs.id = bids.job_id 
    AND jobs.poster_id = auth.uid()
  )
);
