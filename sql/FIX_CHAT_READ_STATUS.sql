-- ============================================
-- FIX: CHAT READ STATUS
-- The current mark_messages_read function only updates notifications,
-- NOT the actual chat_messages table. This fix updates BOTH.
-- ============================================

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_job_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_messages INTEGER;
  v_updated_notifications INTEGER;
BEGIN
  -- 1. Mark actual chat messages as read
  -- Messages sent TO this user (where user is NOT the sender) for this job
  UPDATE chat_messages
  SET is_read = TRUE
  WHERE job_id = p_job_id
    AND sender_id != p_user_id  -- Messages sent BY others
    AND is_read = FALSE;
  
  GET DIAGNOSTICS v_updated_messages = ROW_COUNT;
  
  -- 2. Also mark related notifications as read
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND read = FALSE;
  
  GET DIAGNOSTICS v_updated_notifications = ROW_COUNT;
  
  IF v_updated_messages > 0 OR v_updated_notifications > 0 THEN
    RAISE NOTICE '✅ Marked % messages and % notifications as read for job % user %', 
      v_updated_messages, v_updated_notifications, p_job_id, p_user_id;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID) TO authenticated;

-- Verify
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed mark_messages_read function';
  RAISE NOTICE '';
  RAISE NOTICE 'Now updates BOTH:';
  RAISE NOTICE '  • chat_messages.is_read = TRUE';
  RAISE NOTICE '  • notifications.read = TRUE';
  RAISE NOTICE '';
END $$;
