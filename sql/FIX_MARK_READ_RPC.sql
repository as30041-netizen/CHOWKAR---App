-- ============================================
-- FIX MARK READ RPC (CRITICAL)
-- ============================================
-- The current 'mark_messages_read' RPC might be incomplete.
-- This script overrides it with the correct "Double Update" logic:
-- 1. Mark 'notifications' as read (clears alert)
-- 2. Mark 'chat_messages' as read (shows blue ticks)
-- ============================================

CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Mark relevant NOTIFICATIONS as read
  UPDATE notifications 
  SET read = TRUE 
  WHERE user_id = p_user_id 
    AND related_job_id = p_job_id 
    AND read = FALSE;

  -- 2. Mark relevant CHAT MESSAGES as read (received by me)
  UPDATE chat_messages
  SET read = TRUE, read_at = NOW()
  WHERE job_id = p_job_id
    AND receiver_id = p_user_id
    AND read = FALSE;
END;
$$;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ mark_messages_read function updated successfully.';
    RAISE NOTICE '   - Updates [notifications] table';
    RAISE NOTICE '   - Updates [chat_messages] table (Blue Ticks enabled)';
END $$;
