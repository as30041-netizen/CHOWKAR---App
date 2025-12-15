-- Chat Messages Table RLS Fix
-- Run this in Supabase SQL Editor

-- Enable RLS if not already enabled
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can read messages for their jobs" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages for their jobs" ON chat_messages;

-- Policy: Users can read messages for jobs they are involved in (as poster or accepted worker)
CREATE POLICY "Users can read messages for their jobs" ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = chat_messages.job_id
      AND (
        j.poster_id = auth.uid()
        OR j.accepted_bid_id IN (SELECT id FROM bids WHERE worker_id = auth.uid())
      )
    )
  );

-- Policy: Users can insert messages for jobs they are involved in
CREATE POLICY "Users can insert messages for their jobs" ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = chat_messages.job_id
      AND (
        j.poster_id = auth.uid()
        OR j.accepted_bid_id IN (SELECT id FROM bids WHERE worker_id = auth.uid())
      )
    )
  );

-- Enable Realtime for chat_messages table
-- This should be done in Supabase Dashboard: Database -> Replication -> Enable for chat_messages table
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
