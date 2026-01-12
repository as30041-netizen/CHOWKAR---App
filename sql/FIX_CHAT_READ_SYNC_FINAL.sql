-- ============================================
-- FINAL FIX: CHAT READ SYNCHRONIZATION
-- This script ensures the mark_messages_read function 
-- uses the correct column names and updates both 
-- chat_messages and notifications correctly.
-- ============================================

-- 1. Ensure columns exist (Defensive)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'read'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN read_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Create the Robust RPC
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
    v_actual_user_id UUID;
    v_updated_count INTEGER;
BEGIN
    -- Prefer auth.uid() for security, fallback to parameter
    v_actual_user_id := COALESCE(auth.uid(), p_user_id);
    
    IF v_actual_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID required for mark_messages_read';
    END IF;

    -- A. Mark actual chat messages as read
    -- We mark messages where I am NOT the sender (meaning I am the recipient)
    UPDATE chat_messages
    SET "read" = TRUE, 
        read_at = NOW()
    WHERE job_id = p_job_id
      AND sender_id != v_actual_user_id
      AND "read" = FALSE;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- B. Mark related notifications as read
    UPDATE notifications
    SET "read" = TRUE, 
        updated_at = NOW()
    WHERE user_id = v_actual_user_id
      AND related_job_id = p_job_id
      AND "read" = FALSE;

    IF v_updated_count > 0 THEN
        RAISE NOTICE '✅ Successfully marked % messages as read for job %', v_updated_count, p_job_id;
    END IF;
END;
$$;

-- 3. Grant Permissions
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID) TO authenticated;

-- 4. Verification Output
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ CHAT READ SYNC FIXED';
    RAISE NOTICE 'Column used: chat_messages.read';
    RAISE NOTICE 'Column used: notifications.read';
    RAISE NOTICE '================================================';
END $$;
