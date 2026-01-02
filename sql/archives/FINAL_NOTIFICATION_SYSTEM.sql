-- ============================================
-- FINAL NOTIFICATION FIX
-- 1. Fix RLS on notifications table
-- 2. Consolidate all triggers
-- ============================================

-- 1. ENABLE RLS & FIX POLICIES
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to SEE their own notifications (Critical for Realtime)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to UPDATE (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Allow System/Server/Triggers to INSERT (Users normally don't insert notifications manually, but triggers run as SECURITY DEFINER so they bypass this. 
-- However, if we use client-side logic, we might need this. But best practice is RPC or Trigger.)
-- Let's allow users to insert notifications ONLY for themselves (debug/testing) or via RPC.
-- Triggers bypass RLS, so we don't need a permissive INSERT policy for triggers.

-- 2. NOTIFICATION TRIGGERS (Re-applying to ensure consistency)

-- Trigger: New Bid -> Notify Poster
CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;

  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (v_job.poster_id, 'INFO', 'New Bid Received! 🔔', COALESCE(v_worker_name, 'A worker') || ' placed a bid of ₹' || NEW.amount || ' on "' || v_job.title || '"', NEW.job_id, false, NOW());
  
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
CREATE TRIGGER on_bid_created_notify AFTER INSERT ON bids FOR EACH ROW EXECUTE FUNCTION notify_poster_on_new_bid();

-- Trigger: Bid Accepted -> Notify Worker & Others
CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_poster_name TEXT;
BEGIN
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_poster_name FROM profiles WHERE id = v_job.poster_id;
    
    -- Notify Worker
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (NEW.worker_id, 'SUCCESS', 'You Got the Job! 🎉', COALESCE(v_poster_name, 'Employer') || ' selected you for "' || v_job.title || '"', NEW.job_id, false, NOW());
    
    -- Notify Others
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT worker_id, 'INFO', 'Job Update', 'Another worker was selected for "' || v_job.title || '"', NEW.job_id, false, NOW()
    FROM bids WHERE job_id = NEW.job_id AND worker_id != NEW.worker_id AND status = 'PENDING';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
CREATE TRIGGER trigger_notify_on_bid_accept AFTER UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION notify_on_bid_accept();

-- Trigger: Chat Message -> Notify Recipient
CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_sender_name TEXT;
  v_recipient_id UUID;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  
  IF NEW.sender_id = v_job.poster_id THEN
    -- Sender is Poster -> Notify Accepted Worker
    SELECT worker_id INTO v_recipient_id FROM bids WHERE id = v_job.accepted_bid_id;
  ELSE
    -- Sender is Worker -> Notify Poster
    v_recipient_id := v_job.poster_id;
  END IF;
  
  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (v_recipient_id, 'INFO', COALESCE(v_sender_name, 'New Message'), LEFT(NEW.text, 50), NEW.job_id, false, NOW());
  END IF;
  
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
CREATE TRIGGER trigger_notify_on_chat_message AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION notify_on_chat_message();

-- Trigger: Counter Offer -> Notify the OTHER party (not the one who countered)
CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_job RECORD;
  v_last_entry JSONB;
  v_last_by TEXT;
  v_recipient_id UUID;
  v_counter_name TEXT;
BEGIN
  -- Only proceed if amount or negotiation history changed
  IF (NEW.amount != OLD.amount OR NEW.negotiation_history != OLD.negotiation_history) AND NEW.status = 'PENDING' THEN
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     
     -- Get the LAST entry from negotiation_history to see WHO made the counter
     v_last_entry := NEW.negotiation_history->-1;
     v_last_by := v_last_entry->>'by';  -- Field is 'by', not 'role'
     
     -- Determine who to notify (the opposite party)
     IF v_last_by = 'POSTER' THEN
       -- Poster made the counter -> Notify WORKER
       v_recipient_id := NEW.worker_id;
       v_counter_name := 'Customer';
     ELSIF v_last_by = 'WORKER' THEN
       -- Worker made the counter -> Notify POSTER
       v_recipient_id := v_job.poster_id;
       SELECT name INTO v_counter_name FROM profiles WHERE id = NEW.worker_id;
     ELSE
       -- Unknown role, skip
       RETURN NEW;
     END IF;
     
     -- Send notification
     INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
     VALUES (v_recipient_id, 'INFO', 'Counter Offer 💬', COALESCE(v_counter_name, 'Someone') || ' countered with ₹' || NEW.amount || ' for "' || v_job.title || '"', NEW.job_id, false, NOW());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
CREATE TRIGGER trigger_notify_on_counter_offer AFTER UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION notify_on_counter_offer();

-- Trigger: Job Cancelled -> Notify Bidders (Handled in RPC, but let's add fail-safe trigger?)
-- No, RPC is safer for custom logic.
