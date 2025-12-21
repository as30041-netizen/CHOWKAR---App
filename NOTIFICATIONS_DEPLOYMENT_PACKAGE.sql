-- ============================================
-- FINAL NOTIFICATION DEPLOYMENT PACKAGE
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- This script unifies everything:
-- 1. Security (Message masking for unpaid workers)
-- 2. FCM Push (Even when app is killed)
-- 3. Dynamic Fees (₹50 default)
-- 4. Clean Triggers (Drops all previous variants)
-- 5. Mark Read RPC (Fix for 400 error)

-- ============================================
-- 0. EXTENSIONS & LOGGING
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. MARK MESSAGES READ FIX (RPC)
-- ============================================
CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE notifications SET read = TRUE 
  WHERE user_id = p_user_id AND related_job_id = p_job_id AND read = FALSE;
END;
$$;

-- ============================================
-- 2. PUSH NOTIFICATION HELPER
-- ============================================
-- IMPORTANT: You must replace the placeholders below or set them in Supabase
CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_user_id UUID, p_title TEXT, p_body TEXT, p_job_id UUID, p_type TEXT, p_notification_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_push_token TEXT;
  v_url TEXT;
  v_key TEXT;
BEGIN
  -- 1. Get push token
  SELECT push_token INTO v_push_token FROM public.profiles WHERE id = p_user_id;
  
  -- 2. Fetch config (or hardcode)
  -- If you haven't set these, the function will just exit safely
  SELECT value INTO v_url FROM public.app_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public.app_config WHERE key = 'service_role_key';
  
  IF v_push_token IS NOT NULL AND v_url IS NOT NULL AND v_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := jsonb_build_object(
        'userId', p_user_id, 'title', p_title, 'body', p_body,
        'data', jsonb_build_object('jobId', p_job_id::TEXT, 'type', p_type, 'notificationId', p_notification_id::TEXT)
      )::text
    );
  END IF;
END;
$$;

-- ============================================
-- 3. UNIFIED TRIGGERS
-- ============================================

-- DROP ALL VARIANTS TO PREVENT DUPLICATES
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_new_bid ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_reject ON bids;
DROP TRIGGER IF EXISTS notify_on_new_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_unlock ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_job_completion ON jobs;
DROP TRIGGER IF EXISTS trigger_notify_on_review ON reviews;
DROP TRIGGER IF EXISTS on_review_created ON reviews;

-- A. NEW BID
CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD; v_worker_name TEXT; v_notif_id UUID;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM public.profiles WHERE id = NEW.worker_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_job_id)
  VALUES (v_job.poster_id, 'INFO', 'New Bid: ₹' || NEW.amount || ' 🔔', 
          COALESCE(v_worker_name, 'A worker') || ' wants to work on "' || v_job.title || '".', NEW.job_id)
  RETURNING id INTO v_notif_id;

  PERFORM public.send_push_notification(v_job.poster_id, 'New Bid: ₹' || NEW.amount || ' 🔔', 
                                        COALESCE(v_worker_name, 'A worker') || ' wants to work on your job.', 
                                        NEW.job_id, 'new_bid', v_notif_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_notify_on_new_bid AFTER INSERT ON bids FOR EACH ROW EXECUTE FUNCTION notify_poster_on_new_bid();

-- B. BID ACCEPTED (HIRED)
CREATE OR REPLACE FUNCTION notify_on_bid_accept()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_job RECORD; v_name TEXT; v_notif_id UUID;
BEGIN
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_name FROM profiles WHERE id = v_job.poster_id;
    
    INSERT INTO notifications (user_id, type, title, message, related_job_id)
    VALUES (NEW.worker_id, 'SUCCESS', 'You''re Hired! 🎉', 
            COALESCE(v_name, 'Employer') || ' selected you for "' || v_job.title || '". Tap to start!', NEW.job_id)
    RETURNING id INTO v_notif_id;

    PERFORM public.send_push_notification(NEW.worker_id, 'You''re Hired! 🎉', 
                                          'Employer is waiting to discuss "' || v_job.title || '".', NEW.job_id, 'bid_accepted', v_notif_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_notify_on_bid_accept AFTER UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION notify_on_bid_accept();

-- C. COUNTER OFFER
CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_job RECORD; v_last_by TEXT; v_to UUID; v_amt INTEGER; v_notif_id UUID;
BEGIN
  IF (NEW.amount != OLD.amount OR NEW.negotiation_history != OLD.negotiation_history) AND NEW.status = 'PENDING' THEN
     SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
     v_last_by := NEW.negotiation_history->-1->>'by';
     
     IF v_last_by = 'POSTER' THEN v_to := NEW.worker_id; ELSE v_to := v_job.poster_id; END IF;
     
     INSERT INTO notifications (user_id, type, title, message, related_job_id)
     VALUES (v_to, 'INFO', 'Counter Offer 💬', 'New offer: ₹' || NEW.amount || ' for "' || v_job.title || '".', NEW.job_id)
     RETURNING id INTO v_notif_id;

     PERFORM public.send_push_notification(v_to, 'Counter Offer 💬', 'New offer: ₹' || NEW.amount || ' for "' || v_job.title || '".', 
                                           NEW.job_id, 'counter_offer', v_notif_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_notify_on_counter_offer AFTER UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION notify_on_counter_offer();

-- D. CHAT SECURITY & NOTIFICATION
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_job RECORD; v_name TEXT; v_paid BOOLEAN; v_bid RECORD; v_notif_id UUID; v_preview TEXT; v_fee INTEGER;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_name FROM profiles WHERE id = NEW.sender_id;
  SELECT COALESCE(value::INTEGER, 50) INTO v_fee FROM app_config WHERE key = 'connection_fee';

  SELECT * INTO v_bid FROM bids WHERE job_id = NEW.job_id AND worker_id = NEW.receiver_id AND status = 'ACCEPTED';
  IF FOUND THEN v_paid := (v_bid.connection_payment_status = 'PAID'); ELSE v_paid := TRUE; END IF;

  IF NOT v_paid THEN v_preview := 'Pay ₹' || v_fee || ' to unlock chat details.'; ELSE v_preview := LEFT(NEW.text, 60); END IF;

  INSERT INTO notifications (user_id, type, title, message, related_job_id)
  VALUES (NEW.receiver_id, 'INFO', COALESCE(v_name, 'Someone') || ': ' || v_job.title, v_preview, NEW.job_id)
  RETURNING id INTO v_notif_id;

  PERFORM public.send_push_notification(NEW.receiver_id, COALESCE(v_name, 'New Message'), v_preview, NEW.job_id, 'chat_message', v_notif_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_notify_on_chat AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION notify_on_new_message();

-- E. CHAT UNLOCKED
CREATE OR REPLACE FUNCTION notify_on_chat_unlock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_job RECORD; v_name TEXT; v_notif_id UUID;
BEGIN
  IF NEW.connection_payment_status = 'PAID' AND OLD.connection_payment_status != 'PAID' THEN
    SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
    SELECT name INTO v_name FROM profiles WHERE id = NEW.worker_id;

    INSERT INTO notifications (user_id, type, title, message, related_job_id)
    VALUES (v_job.poster_id, 'SUCCESS', 'Chat Unlocked! 💬', COALESCE(v_name, 'Worker') || ' is ready to discuss details.', NEW.job_id)
    RETURNING id INTO v_notif_id;

    PERFORM public.send_push_notification(v_job.poster_id, 'Chat Unlocked! 💬', COALESCE(v_name, 'Worker') || ' ready to chat.', 
                                          NEW.job_id, 'chat_unlocked', v_notif_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_notify_on_chat_unlock AFTER UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION notify_on_chat_unlock();

-- ============================================
-- 4. CONFIGURE PUSH (OPTIONAL BUT RECOMMENDED)
-- ============================================
-- Uncomment and run these separately with your values:
-- INSERT INTO app_config (key, value) VALUES ('supabase_url', 'https://your-proj.supabase.co') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- INSERT INTO app_config (key, value) VALUES ('service_role_key', 'your-secret-key') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
