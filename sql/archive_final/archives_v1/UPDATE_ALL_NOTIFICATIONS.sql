-- ============================================
-- COMPLETE NOTIFICATION SYSTEM - FINAL VERSION
-- Run this to update all notification messages and add missing triggers
-- ============================================

-- This script:
-- 1. Updates all notification messages to match implementation plan
-- 2. Adds missing bid rejection trigger
-- 3. Ensures old/new amount comparison in counter offers
-- 4. Uses excitement-driven, contextual messaging

-- ============================================
-- 1. NEW BID NOTIFICATION (Updated Message)
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
    COALESCE(v_worker_name, 'A worker') || ' wants to work on "' || v_job.title || '". Review their bid and profile now!', 
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
-- 2. COUNTER OFFER NOTIFICATION (With Old/New Amounts)
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
  -- Only proceed if amount or negotiation history changed
  IF (NEW.amount != OLD.amount OR NEW.negotiation_history != OLD.negotiation_history) AND NEW.status = 'PENDING' THEN
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     
     v_old_amount := OLD.amount;
     v_new_amount := NEW.amount;
     
     -- Get the LAST entry from negotiation_history to see WHO made the counter
     v_last_entry := NEW.negotiation_history->-1;
     v_last_by := v_last_entry->>'by';  -- Field is 'by', not 'role'
     
     -- Determine who to notify (the opposite party)
     IF v_last_by = 'POSTER' THEN
       -- Poster made the counter -> Notify WORKER
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
       -- Worker made the counter -> Notify POSTER
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
-- 3. BID ACCEPTANCE NOTIFICATION (Excitement-Driven)
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_poster_name TEXT;
BEGIN
  -- Check if job status changed to IN_PROGRESS (bid was accepted)
  IF NEW.status = 'IN_PROGRESS' AND OLD.status != 'IN_PROGRESS' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify ACCEPTED WORKER with exciting message
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id,
      'SUCCESS',
      'You''re Hired! 🎉',
      COALESCE(v_poster_name, 'The employer') || ' is waiting to discuss "' || v_job.title || '" with you. Chat now to lock in the ₹' || NEW.amount || ' work!',
      NEW.job_id,
      false,
      NOW()
    );
    
    -- Notify ALL OTHER PENDING BIDDERS (rejection notification)
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
-- 4. BID REJECTION NOTIFICATION (NEW - Previously Missing)
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_bid_reject()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Detect when bid status changes from PENDING to REJECTED
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
-- 5. CHAT MESSAGE NOTIFICATION (Already Correct)
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_sender_name TEXT;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Notify the RECEIVER (not the sender)
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
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_new_message ON chat_messages;
CREATE TRIGGER notify_on_new_message 
AFTER INSERT ON chat_messages 
FOR EACH ROW 
EXECUTE FUNCTION notify_on_new_message();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify all triggers are created:

-- 1. Check all notification triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND event_object_table IN ('bids', 'chat_messages')
  AND trigger_name LIKE '%notif%'
ORDER BY event_object_table, trigger_name;

-- Expected output:
-- on_bid_created_notify       INSERT  bids
-- trigger_notify_on_bid_accept UPDATE  bids
-- trigger_notify_on_bid_reject UPDATE  bids  (NEW)
-- trigger_notify_on_counter_offer UPDATE bids
-- notify_on_new_message        INSERT  chat_messages

-- 2. Check RLS policies on notifications table
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- Expected: 2 policies (SELECT and UPDATE for users)

-- ============================================
-- TESTING CHECKLIST
-- ============================================

/*
After running this script, test:

1. NEW BID:
   - Worker bids on job
   - Poster should see: "New Bid: ₹3500 🔔 - Worker wants to work on your job..."

2. COUNTER OFFER (Poster → Worker):
   - Poster sends counter ₹3200 (was ₹3500)
   - Worker should see: "Employer Countered! 💬 - New offer: ₹3200 (was ₹3500)..."

3. COUNTER OFFER (Worker → Poster):
   - Worker counters ₹3300
   - Poster should see: "Worker Countered 💬 - New bid: ₹3300 (was ₹3200)..."

4. BID ACCEPTED:
   - Poster accepts bid
   - Winner should see: "You're Hired! 🎉 - Employer is waiting to discuss..."
   - Others should see: "Position Filled - Job hired another worker..."

5. BID REJECTED:
   - Poster explicitly rejects bid
   - Worker should see: "Bid Not Selected - Your ₹3500 bid wasn't chosen..."

6. CHAT MESSAGE:
   - Either party sends message
   - Other should see: "SenderName: JobTitle - [message preview]"

All notifications should:
- Appear instantly (real-time)
- Show in foreground as toast
- Show in background as system push
- Have correct badge count
- Navigate to correct screen on tap
*/

-- ============================================
-- DONE!
-- ============================================
-- All notification triggers are now updated with:
-- ✅ Contextual, exciting messages
-- ✅ Old/new amount comparisons
-- ✅ Bid rejection support (NEW)
-- ✅ Proper recipient targeting
-- ✅ Security DEFINER for RLS bypass
-- ============================================
