-- FINAL ROBUST FIX (V2)
-- ensures ALL policies (Insert/Select) are present and correct.

-- 1. Ensure receiver_id column exists
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id);

-- 2. RESET ALL POLICIES (Clean Slate)
DROP POLICY IF EXISTS "Debug Open Policy" ON chat_messages;
DROP POLICY IF EXISTS "Users can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Fast Chat Policy" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Secure Realtime Policy" ON chat_messages;

-- 3. SELECT Policy (Sender OR Receiver can see)
CREATE POLICY "Chat Select Policy" ON chat_messages
FOR SELECT USING (
  auth.uid() = sender_id 
  OR 
  auth.uid() = receiver_id
);

-- 4. INSERT Policy (Sender can create)
CREATE POLICY "Chat Insert Policy" ON chat_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

-- 5. UPDATE Policy (Sender can edit/delete soft?)
-- Optional, but good to have
CREATE POLICY "Chat Update Policy" ON chat_messages
FOR UPDATE USING (auth.uid() = sender_id);

-- 6. Permissions
GRANT ALL ON chat_messages TO authenticated;

-- 7. Replica Identity
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
