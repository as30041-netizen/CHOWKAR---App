-- ============================================
-- FIX CHAT SCHEMA AND RPC
-- Addresses missing columns and read receipt logic
-- ============================================

-- 1. Add missing columns to chat_messages
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('voice', 'image', 'video')),
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_duration integer,
ADD COLUMN IF NOT EXISTS read boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- 2. Update mark_messages_read RPC to actually mark messages as read
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
  -- 1. Mark actual chat messages as read
  -- (Messages in this job sent by ANYONE ELSE are considered received by p_user_id)
  UPDATE chat_messages
  SET read = TRUE, read_at = NOW()
  WHERE job_id = p_job_id
    AND sender_id != p_user_id -- Don't mark own messages
    AND read = FALSE;

  -- 2. Mark notifications for messages in this job as read
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND type = 'INFO'
    AND title LIKE '%Message%'
    AND read = FALSE;
  
  RAISE NOTICE '✅ Messages and notifications marked as read for job % user %', p_job_id, p_user_id;
END;
$$;

RAISE NOTICE '✅ Chat Schema Fixed and RPC Updated';
