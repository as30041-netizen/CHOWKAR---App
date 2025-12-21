-- ============================================
-- CRITICAL FIX: Chat Message Notification Security
-- Prevents message content leak before worker pays ₹50
-- ============================================

-- ISSUE: Worker can see poster's message content in notifications
-- BEFORE paying the chat unlock fee, bypassing payment requirement

-- FIX: Check if worker has paid before showing message content
--      If NOT paid: Show generic "Unlock chat" message
--      If paid: Show actual message preview

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

  -- Get connection fee from config
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
    -- Generic notification protecting message content
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.receiver_id, 
      'SUCCESS', 
      'Employer Ready to Chat! 💬',
      'Pay ₹' || v_connection_fee || ' to unlock chat and discuss "' || v_job.title || '" details with employer!',
      NEW.job_id, 
      false, 
      NOW()
    );
  ELSE
    -- Normal notification with message preview (poster or paid worker)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.receiver_id, 
      'INFO', 
      COALESCE(v_sender_name, 'Someone') || ': ' || v_job.title,
      LEFT(NEW.text, 60) || CASE WHEN LENGTH(NEW.text) > 60 THEN '...' ELSE '' END,
      NEW.job_id, 
      false, 
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS notify_on_new_message ON chat_messages;
CREATE TRIGGER notify_on_new_message 
AFTER INSERT ON chat_messages 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_new_message();

-- ============================================
-- VERIFICATION
-- ============================================

-- Test this fix:
-- 1. Accept a bid (worker selected but NOT paid)
-- 2. Poster sends message
-- 3. Worker should get: "Pay ₹50 to unlock chat..."
-- 4. Worker should NOT see message content
-- 5. After payment, worker should see message preview

-- Run this to verify trigger updated:
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'notify_on_new_message';

-- Expected: 1 row showing trigger on chat_messages table
