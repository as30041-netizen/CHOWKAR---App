-- ============================================
-- MASTER FIX: All Notification Fixes in One File
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- This file fixes:
-- 1. mark_messages_read error (updated_at column missing)
-- 2. Chat message security leak (message shown before payment)
-- 3. All notification messages (contextual, exciting content)
-- 4. Missing bid rejection trigger
-- 5. Counter offer with old/new amounts

-- ============================================
-- FIX 1: MARK_MESSAGES_READ (Stop 400 Error Loop)
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
BEGIN
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND read = FALSE;
  
  RAISE NOTICE '✅ Notifications marked as read for job % user %', p_job_id, p_user_id;
END;
$$;

-- ============================================
-- FIX 2: CHAT MESSAGE SECURITY (Prevent Message Leak)
-- ============================================

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
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.receiver_id, 
      'SUCCESS', 
      'Employer Ready to Chat! 💬',
      'Pay ₹' || v_connection_fee || ' to unlock chat and discuss "' || v_job.title || '" details!',
      NEW.job_id, 
      false, 
      NOW()
    );
  ELSE
    -- Normal notification with preview (poster or paid worker)
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

DROP TRIGGER IF EXISTS notify_on_new_message ON chat_messages;
CREATE TRIGGER notify_on_new_message 
AFTER INSERT ON chat_messages 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_new_message();

-- ============================================
-- FIX 3: NEW BID NOTIFICATION (Updated Message)
-- ============================================

CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;

  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_job.poster_id, 
    'INFO', 
    'New Bid: ₹' || NEW.amount || ' 🔔', 
    COALESCE(v_worker_name, 'A worker') || ' wants to work on "' || v_job.title || '". Review their bid now!', 
    NEW.job_id, 
    false, 
    NOW()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
CREATE TRIGGER on_bid_created_notify 
AFTER INSERT ON bids 
FOR EACH ROW 
EXECUTE FUNCTION notify_poster_on_new_bid();

-- ============================================
-- FIX 4: COUNTER OFFER (With Old/New Amounts)
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_job RECORD;
  v_last_entry JSONB;
  v_last_by TEXT;
  v_recipient_id UUID;
  v_counter_name TEXT;
  v_old_amount INTEGER;
  v_new_amount INTEGER;
BEGIN
  IF (NEW.amount != OLD.amount OR NEW.negotiation_history != OLD.negotiation_history) AND NEW.status = 'PENDING' THEN
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     
     v_old_amount := OLD.amount;
     v_new_amount := NEW.amount;
     
     v_last_entry := NEW.negotiation_history->-1;
     v_last_by := v_last_entry->>'by';
     
     IF v_last_by = 'POSTER' THEN
       v_recipient_id := NEW.worker_id;
       
       INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
       VALUES (
         v_recipient_id, 
         'INFO', 
         'Employer Countered! 💬',
         'New offer: ₹' || v_new_amount || ' for "' || v_job.title || '" (was ₹' || v_old_amount || '). Accept, reject, or counter back!',
         NEW.job_id, 
         false, 
         NOW()
       );
       
     ELSIF v_last_by = 'WORKER' THEN
       v_recipient_id := v_job.poster_id;
       SELECT name INTO v_counter_name FROM profiles WHERE id = NEW.worker_id;
       
       INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
       VALUES (
         v_recipient_id, 
         'INFO', 
         COALESCE(v_counter_name, 'Worker') || ' Countered 💬',
         'New bid: ₹' || v_new_amount || ' for "' || v_job.title || '" (was ₹' || v_old_amount || '). Accept or counter back!',
         NEW.job_id, 
         false, 
         NOW()
       );
     END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
CREATE TRIGGER trigger_notify_on_counter_offer 
AFTER UPDATE ON bids 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_counter_offer();

-- ============================================
-- FIX 5: BID ACCEPTANCE (Exciting Message)
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_poster_name TEXT;
BEGIN
  IF NEW.status = 'IN_PROGRESS' AND OLD.status != 'IN_PROGRESS' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify WINNER only (single notification)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      'You''re Hired! 🎉',
      COALESCE(v_poster_name, 'Employer') || ' is waiting to discuss "' || v_job.title || '" with you. Chat now to lock in the ₹' || NEW.amount || ' work!',
      NEW.job_id,
      false,
      NOW()
    );
    
    -- Notify OTHER bidders (not winner)
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT 
      worker_id,
      'INFO',
      'Position Filled',
      '"' || v_job.title || '" hired another worker. Keep browsing for more opportunities!',
      NEW.job_id,
      false,
      NOW()
    FROM bids
    WHERE job_id = NEW.job_id 
      AND status = 'PENDING' 
      AND worker_id != NEW.worker_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
CREATE TRIGGER trigger_notify_on_bid_accept 
AFTER UPDATE ON bids 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_bid_accept();

-- ============================================
-- FIX 6: BID REJECTION (NEW Trigger)
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_bid_reject()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
BEGIN
  IF NEW.status = 'REJECTED' AND OLD.status = 'PENDING' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'INFO',
      'Bid Not Selected',
      'Your ₹' || NEW.amount || ' bid for "' || v_job.title || '" wasn''t chosen. Check other jobs!',
      NEW.job_id,
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_bid_reject ON bids;
CREATE TRIGGER trigger_notify_on_bid_reject
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_reject();

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify all triggers are created:
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND event_object_table IN ('bids', 'chat_messages')
ORDER BY event_object_table, trigger_name;

-- Expected Output:
-- on_bid_created_notify           INSERT  bids
-- trigger_notify_on_bid_accept    UPDATE  bids
-- trigger_notify_on_bid_reject    UPDATE  bids
-- trigger_notify_on_counter_offer UPDATE  bids
-- notify_on_new_message           INSERT  chat_messages

-- ============================================
-- DONE! All fixes applied.
-- ============================================
