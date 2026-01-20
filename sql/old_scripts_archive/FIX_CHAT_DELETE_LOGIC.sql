-- ============================================
-- FIX CHAT DELETE LOGIC & SECURE VIEW
-- ============================================
-- 1. Updates soft_delete_chat_message to PRESERVE original text (for analytics).
-- 2. Creates view_chat_messages to MASK deleted text (for frontend/privacy).

-- ============================================
-- STEP 1: Update Soft Delete Function
-- ============================================

CREATE OR REPLACE FUNCTION soft_delete_chat_message(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Soft delete: Mark as deleted, BUT DO NOT OVERWRITE TEXT
    -- This allows analytics to still see what was written
    UPDATE chat_messages
    SET 
        is_deleted = TRUE
        -- text = 'This message was deleted'  <-- REMOVED: We keep the text now
    WHERE id = p_message_id 
      AND sender_id = auth.uid();  -- Only sender can delete their own message
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found or you are not the sender';
    END IF;
    
    RAISE NOTICE '✅ Message soft-deleted (Data preserved): %', p_message_id;
END;
$$;

-- ============================================
-- STEP 2: Create Secure View
-- ============================================

DROP VIEW IF EXISTS view_chat_messages;

CREATE VIEW view_chat_messages AS
SELECT
  id,
  job_id,
  sender_id,
  receiver_id,
  -- MASKING LOGIC: If deleted, hide the text
  CASE 
    WHEN is_deleted THEN '🚫 This message was deleted'
    ELSE text 
  END AS text,
  translated_text,
  created_at,
  read,
  read_at,
  is_deleted
FROM chat_messages;

-- Grant access to the view
GRANT SELECT ON view_chat_messages TO authenticated;

-- ============================================
-- STEP 3: Verify
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Soft delete function updated to preserve data.';
    RAISE NOTICE '✅ Secure View `view_chat_messages` created.';
    RAISE NOTICE '👉 NEXT: Update frontend to query `view_chat_messages` instead of table.';
END $$;
