-- CHAT FEATURES UPDATE
-- 1. Soft Delete Support
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. RPC to Soft Delete
-- Only the SENDER can delete their own message
CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE chat_messages
  SET is_deleted = TRUE,
      deleted_at = NOW(),
      text = 'This message was deleted' -- Optional: Mask content
  WHERE id = p_message_id
  AND sender_id = auth.uid(); -- Security: Only sender can delete
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
