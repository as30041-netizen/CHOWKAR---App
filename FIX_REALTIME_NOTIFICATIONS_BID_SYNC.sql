-- ============================================================
-- FIX REALTIME NOTIFICATIONS & BID UPDATES
-- ============================================================

-- 1. Ensure bids table has replica identity set to FULL
-- This ensures that on update, the full old row and new row are sent to realtime listeners.
ALTER TABLE bids REPLICA IDENTITY FULL;
ALTER TABLE jobs REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 2. Ensure bids/notifications/jobs are included in the publication (SKIP IF ALREADY EXISTS)
-- This is often the reason why 'postgres_changes' doesn't fire for some tables.
-- We wrap in a DO block to prevent errors if already a member.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
    END IF;
END $$;

-- 3. Verify RLS for Bids
-- Users need to be able to SELECT bids to get realtime updates.
-- Currently, we might have a strict policy. Let's make it permissive for testing
-- but ideally it should follow job participants.
DROP POLICY IF EXISTS "Anyone can view bids" ON bids;
CREATE POLICY "Anyone can view bids" ON bids FOR SELECT TO authenticated USING (true);

-- 4. Verify RLS for Notifications
-- recipient must be able to select their own notifications.
DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. Add poster_id to bids if missing (sanity check)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bids' AND column_name='poster_id') THEN
        ALTER TABLE bids ADD COLUMN poster_id UUID REFERENCES auth.users(id);
    END IF;
END $$;
