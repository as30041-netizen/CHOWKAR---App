-- SECURE & RESTORE RLS (Final Polish)
-- Run this to re-enable security while keeping the app working

-- 1. Notifications: Re-enable RLS but allow necessary inserts
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" 
ON notifications FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
-- Allow authenticated users to send notifications to ANYONE (needed for system/user triggers)
CREATE POLICY "Users can create notifications" 
ON notifications FOR INSERT 
TO authenticated 
WITH CHECK (true); 

-- 2. Reviews: Ensure RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reviews view" ON reviews;
CREATE POLICY "Public reviews view" ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);

-- 3. Bids: Ensure Poster can view (using denormalized poster_id)
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
-- (Assuming FIX_REALTIME_BIDS.sql was run which adds poster_id policy)

-- Grant permissions for RPC
GRANT EXECUTE ON FUNCTION accept_bid TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_rating TO authenticated;
