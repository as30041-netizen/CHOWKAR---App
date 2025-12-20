-- ============================================================
-- FIX REALTIME NOTIFICATIONS FOR ALL USERS
-- The issue: Realtime Authorization requires SELECT permission 
-- for the user to "see" the broadcast, even if they are the recipient.
-- ============================================================

-- CRITICAL: Grant realtime authorization for notifications
-- Supabase Realtime checks RLS policies before broadcasting.
-- The user_id filter in the subscription should match, but we need 
-- the policy to be correctly configured for authenticated users.

-- Step 1: Drop all existing notification policies to start fresh
DROP POLICY IF EXISTS "notif_select" ON notifications;
DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_update" ON notifications;
DROP POLICY IF EXISTS "notif_delete" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can see their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications for others" ON notifications;

-- Step 2: Re-enable RLS (it should already be enabled, but just in case)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 3: Create clean, minimal policies

-- SELECT: Users can only see their own notifications (required for Realtime to broadcast to them)
CREATE POLICY "notif_select_own" ON notifications 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id);

-- INSERT: Any authenticated user can create a notification for anyone 
-- This is essential for cross-user notifications (poster->worker, worker->poster)
CREATE POLICY "notif_insert_any" ON notifications 
    FOR INSERT TO authenticated 
    WITH CHECK (true);

-- UPDATE: Users can only update their own notifications (e.g., marking as read)
CREATE POLICY "notif_update_own" ON notifications 
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id);

-- DELETE: Users can only delete their own notifications
CREATE POLICY "notif_delete_own" ON notifications 
    FOR DELETE TO authenticated 
    USING (auth.uid() = user_id);

-- Step 4: Ensure replica identity is FULL (needed for Realtime to send full row data)
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Step 5: Grant permissions (backup measure)
GRANT ALL ON notifications TO authenticated;

-- Step 6: Verify notification is in realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;
