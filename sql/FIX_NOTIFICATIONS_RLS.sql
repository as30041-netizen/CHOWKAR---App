-- FIX NOTIFICATIONS RLS
-- Run this in Supabase SQL Editor
-- This allows workers to send notifications to posters when a bid is placed

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Give users access to insert notifications" ON notifications;

-- 3. Create permissive insert policy
-- Allows any authenticated user to create a notification for anyone (e.g. Worker notifying Poster)
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Ensure users can only SEE their OWN notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
