-- FIX: Notification Real-Time Subscriptions & RLS
-- Date: Jan 15, 2026
-- Description: Users were not receiving real-time alerts because RLS was either disabled or not configured to allow SELECTs on their own rows.

-- 1. Ensure RLS is enabled
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- 2. Clean up old policies to ensure a fresh start
DROP POLICY IF EXISTS "Users can view their own notifications" ON "notifications";
DROP POLICY IF EXISTS "Users can update their own notifications" ON "notifications"; 
DROP POLICY IF EXISTS "Users can delete their own notifications" ON "notifications";
-- (Insert is usually done by triggers/admin functions, but we can add it if client-side creation is needed)
DROP POLICY IF EXISTS "Users can insert notifications" ON "notifications";

-- 3. Policy: VIEW (Vital for Realtime to work)
CREATE POLICY "Users can view their own notifications"
ON "notifications"
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Policy: UPDATE (For marking as read)
CREATE POLICY "Users can update their own notifications"
ON "notifications"
FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Policy: DELETE (For clearing notifications)
CREATE POLICY "Users can delete their own notifications"
ON "notifications"
FOR DELETE
USING (auth.uid() = user_id);

-- 6. CRITICAL: Add to Realtime Publication
-- If this is missing, no events are sent to the client
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END
$$;
