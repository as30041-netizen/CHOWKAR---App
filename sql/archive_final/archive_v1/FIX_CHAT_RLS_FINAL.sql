-- FIX: RLS Policy for Chat Messages
-- The existing RLS policy might be incomplete or missing "Sender can select"

-- Drop existing policies to be clean
DROP POLICY IF EXISTS "Users can view their chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their chat messages" ON chat_messages;

-- 1. VIEW POLICY
CREATE POLICY "Users can view their chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

-- 2. INSERT POLICY
CREATE POLICY "Users can insert chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    NOT EXISTS (
      SELECT 1 FROM user_blocks 
      WHERE blocker_id = receiver_id AND blocked_id = auth.uid()
    )
  );

-- 3. UPDATE POLICY (for soft delete/editing)
CREATE POLICY "Users can update their chat messages"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- 4. Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Grant access to view
GRANT SELECT ON view_chat_messages TO authenticated;
