-- FINAL SECURE FIX FOR REALTIME
-- We are adding 'receiver_id' to avoid complex Joins in RLS

-- 1. Add receiver_id column
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id);

-- 2. Drop the Debug Policy
DROP POLICY IF EXISTS "Debug Open Policy" ON chat_messages;
DROP POLICY IF EXISTS "Users can view chat messages" ON chat_messages; -- Cleanup old one if present

-- 3. Create Fast & Secure Policy
-- This allows Sender AND Receiver to see the message. 
-- Since it uses direct column comparison, Realtime works perfectly.
CREATE POLICY "Fast Chat Policy" ON chat_messages
FOR SELECT USING (
  auth.uid() = sender_id 
  OR 
  auth.uid() = receiver_id
);

-- 4. Enable Replica Identity (Good practice)
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
