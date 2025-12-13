-- FIX 403 FORBIDDEN ERRORS (Notifications & Counter Offers)
-- Run this in Supabase SQL Editor immediately!

BEGIN;

-- 1. Fix Notifications (Allow anyone to notify anyone)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" 
  ON notifications FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- 2. Fix Bids Updates (Allow Counter Offers)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posters can update bids on their jobs" ON bids;
CREATE POLICY "Posters can update bids on their jobs" 
  ON bids FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = bids.job_id 
      AND jobs.poster_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workers can update own bids" ON bids;
CREATE POLICY "Workers can update own bids" 
  ON bids FOR UPDATE 
  TO authenticated 
  USING (worker_id = auth.uid());

COMMIT;
