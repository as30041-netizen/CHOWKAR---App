-- ========================================================
-- FIX: Mark Messages Read RPC & Notifications Schema
-- ========================================================

-- 1. Fix Missing Column in Notifications Table
-- This resolves the "column updated_at does not exist" error
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Redefine mark_messages_read to update BOTH Chat Messages and Notifications
-- This ensures that when a user opens a chat, both the message read receipts 
-- and the notification bubble are updated.
CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A. Mark Chat Messages as Read (Updates Read Receipts)
  UPDATE chat_messages 
  SET read = TRUE, read_at = NOW()
  WHERE job_id = p_job_id 
    AND receiver_id = p_user_id 
    AND read = FALSE;

  -- B. Mark Related Notifications as Read (Clears Bell Icon)
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND read = FALSE;
END;
$$;

-- 3. Verify Trigger for Notifications on New Messages
-- Ensure that the trigger to create notifications exists and is correct.
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_sender_name TEXT;
  v_worker_paid BOOLEAN := FALSE;
  v_receiver_is_worker BOOLEAN := FALSE;
  v_bid RECORD;
  v_connection_fee INTEGER;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Get connection fee from config (default 50)
  SELECT COALESCE(value::INTEGER, 50) INTO v_connection_fee 
  FROM app_config WHERE key = 'connection_fee';

  -- Check if receiver is the worker (not poster)
  SELECT * INTO v_bid 
  FROM bids 
  WHERE job_id = NEW.job_id 
    AND worker_id = NEW.receiver_id
    AND status = 'IN_PROGRESS';
  
  IF FOUND THEN
    v_receiver_is_worker := TRUE;
    v_worker_paid := (v_bid.connection_payment_status = 'PAID');
  END IF;

  -- SECURITY: If receiver is unpaid worker, hide message content
  IF v_receiver_is_worker AND NOT v_worker_paid THEN
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
    VALUES (
      NEW.receiver_id, 
      'SUCCESS', 
      'Employer Ready to Chat! 💬',
      'Pay ₹' || v_connection_fee || ' to unlock chat and discuss "' || v_job.title || '" details!',
      NEW.job_id, 
      false, 
      NOW(),
      NOW()
    );
  ELSE
    -- Normal notification with preview (poster or paid worker)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at, updated_at)
    VALUES (
      NEW.receiver_id, 
      'INFO', 
      COALESCE(v_sender_name, 'Someone') || ': ' || v_job.title,
      LEFT(NEW.text, 60) || CASE WHEN LENGTH(NEW.text) > 60 THEN '...' ELSE '' END,
      NEW.job_id, 
      false, 
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Re-apply trigger to be safe
DROP TRIGGER IF EXISTS notify_on_new_message ON chat_messages;
CREATE TRIGGER notify_on_new_message 
AFTER INSERT ON chat_messages 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_new_message();

