-- CHECK & FIX REALTIME PUBLICATION FOR BIDS TABLE
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Check which tables are currently in the realtime publication
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- You should see: jobs, bids, chat_messages, notifications
-- If 'bids' is missing, run Step 2.

-- Step 2: Add bids table to realtime publication (if missing)
ALTER PUBLICATION supabase_realtime ADD TABLE bids;

-- Step 3: Set REPLICA IDENTITY FULL for bids (required for UPDATE/DELETE events)
ALTER TABLE public.bids REPLICA IDENTITY FULL;

-- Step 4: Verify the fix
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
-- Now 'bids' should appear in the list
