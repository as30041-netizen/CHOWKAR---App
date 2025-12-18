-- ============================================================
-- THE "FINAL FINAL" PERMISSION FIX
-- This removes any complex/conflicting RLS policies and resets them.
-- ============================================================

-- 1. CLEAN UP NOTIFICATIONS
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY; -- Momentary disable to ensure clean slate
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can see their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for others" ON notifications;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Recipient can see/update/delete their own
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_delete" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- ANY AUTHENTICATED USER can send a notification
-- This is essential for posters to notify workers and vice versa
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- 2. CLEAN UP CHATS (Ensure auto-archive works)
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can insert their own chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can manage their own chats" ON chats;
DROP POLICY IF EXISTS "Users can update their chats" ON chats;

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Participiant can do everything
CREATE POLICY "chat_all" ON chats
    FOR ALL TO authenticated
    USING (auth.uid() = user1_id OR auth.uid() = user2_id)
    WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 3. CLEAN UP JOBS (Ensure poster can mark completed)
DROP POLICY IF EXISTS "Posters can update their own jobs" ON jobs;
CREATE POLICY "jobs_update_poster" ON jobs 
    FOR UPDATE TO authenticated
    USING (auth.uid() = poster_id);

-- 4. GRANT EVERYTHING TO AUTHENTICATED
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON chats TO authenticated;
GRANT ALL ON jobs TO authenticated;
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON reviews TO authenticated;

-- Ensure schema is correct for transactions (last check)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS related_job_id UUID REFERENCES jobs(id);
