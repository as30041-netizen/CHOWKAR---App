-- FIX REALTIME BIDS VISIBILITY
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Add poster_id to bids table (for efficient RLS)
ALTER TABLE bids ADD COLUMN IF NOT EXISTS poster_id uuid REFERENCES auth.users(id);

-- 2. Backfill existing bids with poster_id from jobs
UPDATE bids 
SET poster_id = jobs.poster_id
FROM jobs 
WHERE bids.job_id = jobs.id 
AND bids.poster_id IS NULL;

-- 3. Optimize RLS for Realtime (Avoid JOINs)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posters can view bids on their jobs" ON bids;
CREATE POLICY "Posters can view bids on their jobs"
  ON bids FOR SELECT
  TO authenticated
  USING (poster_id = auth.uid());

DROP POLICY IF EXISTS "Posters can update bids on their jobs" ON bids;
CREATE POLICY "Posters can update bids on their jobs"
  ON bids FOR UPDATE
  TO authenticated
  USING (poster_id = auth.uid());

COMMIT;
