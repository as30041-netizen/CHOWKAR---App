-- ENABLE REALTIME FOR ALL TABLES
-- Run this in Supabase SQL Editor

-- Enable replication for the tables that need real-time updates
-- This is REQUIRED for Supabase Realtime to work

-- Method 1: Add tables to the realtime publication (Recommended)
BEGIN;
  -- Drop existing publication and recreate with all tables
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    jobs, 
    bids, 
    notifications, 
    chat_messages, 
    transactions,
    profiles;
COMMIT;

-- If the above gives an error, try adding tables individually:
-- ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE bids;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Verify the publication includes your tables:
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
