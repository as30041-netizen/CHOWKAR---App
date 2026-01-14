-- ============================================================================
-- SECURE CHAT SYSTEM (RLS)
-- Enforce strict privacy for Chat Messages and States
-- ============================================================================

BEGIN;

-- 1. CHAT MESSAGES
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing if any (Clean Slate)
DROP POLICY IF EXISTS "Users can view own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages; -- Logical delete or actual?

-- A. View Policy (Sender OR Receiver)
CREATE POLICY "Users can view own messages" ON chat_messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- B. Insert Policy (Sender MUST be auth user)
-- Also optionally check if they are "hired" if we want strict business logic here, 
-- but "Sender Only" is the baseline security requirement.
CREATE POLICY "Users can send messages" ON chat_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- C. Update Policy (Edit) - Sender Only
CREATE POLICY "Users can update own messages" ON chat_messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- 2. CHAT STATES
ALTER TABLE chat_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat state" ON chat_states;

-- A. View/Update Policy (User owns the state row)
CREATE POLICY "Users can manage own chat state" ON chat_states
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMIT;
