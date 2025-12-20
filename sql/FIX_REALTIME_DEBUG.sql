-- DEBUG: OPEN POLICY SCRIPT
-- RUN THIS TO DIAGNOSE IF THE JOIN POLICY IS THE PROBLEM

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Everyone can view messages" ON chat_messages;

-- 2. Create OPEN Policy (DANGEROUS - FOR TESTING ONLY)
-- This allows any logged-in user to see ALL chat messages.
-- If notifications start working after this, we know the "Join" policy was the issue.
CREATE POLICY "Debug Open Policy" ON chat_messages
FOR SELECT USING (true);

-- 3. Ensure Replica Identity
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
