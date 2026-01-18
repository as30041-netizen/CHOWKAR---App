-- FINAL REALTIME SYSTEM UNIFICATION
-- Ensures all tables are in the realtime publication and have full replica identity

BEGIN;

-- 1. Enable Realtime for all core tables
-- This ensures 'postgres_changes' events are actually sent by Supabase
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.bids REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2. Add tables to the supabase_realtime publication if not already present
-- We use a loop/check to avoid errors if they are already there
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'jobs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bids') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;

COMMIT;
