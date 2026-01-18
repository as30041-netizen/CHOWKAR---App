-- ============================================
-- FIX: mark_messages_read RPC Function
-- ERROR: column "updated_at" of relation "notifications" does not exist
-- ============================================

-- The notifications table only has created_at, not updated_at
-- This fix removes the updated_at reference

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_job_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark notifications for messages in this job as read
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND read = FALSE;
  
  RAISE NOTICE '✅ Notifications marked as read for job % user %', p_job_id, p_user_id;
END;
$$;

-- Run this in Supabase SQL Editor to fix the error
