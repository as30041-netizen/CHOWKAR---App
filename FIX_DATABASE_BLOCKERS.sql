-- ============================================================
-- EMERGENCY DATABASE FIX: TRANSACTIONS, CHATS, & NOTIFICATIONS
-- Date: 2024-12-18
-- ============================================================

-- 1. FIX TRANSACTIONS SCHEMA
-- Ensure related_job_id exists for commission tracking
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS related_job_id UUID REFERENCES jobs(id);

-- 2. FIX CHATS RLS (Crucial for auto-archival trigger)
-- Existing policy only allowed SELECT. We need ALL for the trigger/system and basic participant updates.
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can manage their own chats" ON chats;

-- Select policy
CREATE POLICY "Users can view their own chats" ON chats
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Insert policy (needed for participants or trigger on their behalf)
CREATE POLICY "Users can insert their own chats" ON chats
    FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Update policy (needed for archival/deleted states)
CREATE POLICY "Users can update their own chats" ON chats
    FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 3. FIX NOTIFICATIONS RLS
-- Allow users to send notifications to others (especially for job updates/chats)
DROP POLICY IF EXISTS "Users can insert notifications for others" ON notifications;
CREATE POLICY "Users can insert notifications for others" ON notifications
    FOR INSERT WITH CHECK (true); -- Broad insert for now to fix collaboration blockers

-- Also ensure users can see their own notifications
DROP POLICY IF EXISTS "Users can see their own notifications" ON notifications;
CREATE POLICY "Users can see their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- 4. FIX JOB RLS (Ensure posters can update their own jobs)
-- Sometimes updates fail if the policy is too restrictive on what's returned/checked
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Posters can update their own jobs" ON jobs;
CREATE POLICY "Posters can update their own jobs" ON jobs
    FOR UPDATE USING (auth.uid() = poster_id);

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE chats TO authenticated;
GRANT ALL ON TABLE notifications TO authenticated;
GRANT ALL ON TABLE transactions TO authenticated;
GRANT ALL ON TABLE jobs TO authenticated;
