-- FIX ALL RLS ISSUES (Notifications + Bids Update)
-- Run this to fix 403 Forbidden errors when Countering or Notifying

BEGIN;

-- ========================================================
-- 1. NOTIFICATIONS TABLE
-- ========================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Allow ANY authenticated user to insert a notification (e.g. Worker -> Poster, Poster -> Worker)
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());


-- ========================================================
-- 2. BIDS TABLE (Fixing Counter Offer / Updates)
-- ========================================================
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posters can update bids on their jobs" ON bids;
DROP POLICY IF EXISTS "Workers can update own bids" ON bids;

-- Allow Posters to update bids on their own jobs (e.g. for Counter offers, Accepting)
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

-- Allow Workers to update their own bids (e.g. for Counter offers)
CREATE POLICY "Workers can update own bids"
  ON bids FOR UPDATE
  TO authenticated
  USING (worker_id = auth.uid());


COMMIT;
