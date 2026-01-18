-- Allow users to read their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO anon, authenticated
USING (user_id::text = auth.uid()::text OR auth.role() = 'anon'); -- Allow it for testing/anon key

-- Allow everyone to read ALL notifications for debugging (AGGRESSIVE)
-- CREATE POLICY "Everyone can read all notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);

-- Enable replication for notifications if not already done
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Ensure it's in the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
