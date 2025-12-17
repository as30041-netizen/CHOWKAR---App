-- FIX NOTIFICATIONS PERMISSIONS
-- If RLS is enabled but no policy exists, 'addNotification' will fail silently.

-- 1. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. VIEW Policy
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

-- 3. INSERT Policy (CRITICAL for receiving new notifications)
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
CREATE POLICY "Users can create own notifications" ON notifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. UPDATE Policy (For marking read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
FOR UPDATE USING (auth.uid() = user_id);

-- 5. DELETE Policy (For clearing)
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
FOR DELETE USING (auth.uid() = user_id);

-- 6. Grant Permissions
GRANT ALL ON notifications TO authenticated;
