-- MASTER FIX SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR TO FIX ALL ISSUES

BEGIN;

-- 1. FIX NOTIFICATIONS (Error 403)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
-- Allow anyone to notify anyone (fixes 403 error)
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- 2. FIX REALTIME BIDS & VISIBILITY
-- Add poster_id to bids table so real-time updates work efficiently
ALTER TABLE bids ADD COLUMN IF NOT EXISTS poster_id uuid REFERENCES auth.users(id);

-- Backfill existing bids with poster_id
UPDATE bids 
SET poster_id = jobs.poster_id
FROM jobs 
WHERE bids.job_id = jobs.id 
AND bids.poster_id IS NULL;

-- Enable Realtime for Posters via simpler policy
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

-- Allow Workers to update their own bids
DROP POLICY IF EXISTS "Workers can update own bids" ON bids;
CREATE POLICY "Workers can update own bids" 
  ON bids FOR UPDATE 
  TO authenticated 
  USING (worker_id = auth.uid());

COMMIT;
