-- ============================================
-- FINAL NOTIFICATION SYNC & AUDIT FIX
-- ============================================
-- This script synchronizes all notification triggers to ensure:
-- 1. NO DUPLICATES (drops all legacy variations)
-- 2. PUSH NOTIFICATIONS (re-integrates push logic)
-- 3. CONSISTENCY (handles Bids, Counters, and Chat)

-- ============================================
-- 1. CLEANUP OLD TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS trg_notify_poster_on_new_bid ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_new_bid ON bids; 
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_created ON bids;
DROP TRIGGER IF EXISTS trg_notify_on_bid_created ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON bids;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
DROP TRIGGER IF EXISTS trg_notify_on_bid_event ON bids; -- The update-only one
DROP TRIGGER IF EXISTS notify_on_new_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat ON chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_unlock ON bids;

-- Drop Functions to ensure clean slate
DROP FUNCTION IF EXISTS notify_poster_on_new_bid() CASCADE;
DROP FUNCTION IF EXISTS notify_on_bid_event() CASCADE;
DROP FUNCTION IF EXISTS notify_on_chat_message() CASCADE;
DROP FUNCTION IF EXISTS notify_on_new_message() CASCADE;

-- ============================================
-- 2. ENSURE HELPER FUNCTIONS
-- ============================================

-- Ensure send_push_notification exists (Safe version)
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
  
  -- 2. Fetch config
  SELECT value INTO v_url FROM public.app_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public.app_config WHERE key = 'service_role_key';
  
  -- 3. Send if possible
  IF v_push_token IS NOT NULL AND v_url IS NOT NULL AND v_key IS NOT NULL THEN
    -- Use pg_net extension if available, or logging if not
    -- Assuming pg_net is installed as per previous scripts
    BEGIN
        PERFORM net.http_post(
        url := v_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        body := jsonb_build_object(
            'userId', p_user_id, 'title', p_title, 'body', p_body,
            'data', jsonb_build_object('jobId', p_job_id::TEXT, 'type', p_type, 'notificationId', p_notification_id::TEXT)
        )::text
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send push notification via pg_net: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- ============================================
-- 3. BIDDING TRIGGERS (Separate INSERT & UPDATE)
-- ============================================

-- A. NEW BID (INSERT ONLY)
CREATE OR REPLACE FUNCTION notify_on_new_bid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD; 
  v_worker_name TEXT; 
  v_notif_id UUID;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM public.profiles WHERE id = NEW.worker_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_job_id)
  VALUES (v_job.poster_id, 'SUCCESS', 'New Bid: ₹' || NEW.amount || ' 💰', 
          COALESCE(v_worker_name, 'A worker') || ' has placed a bid on "' || v_job.title || '".', NEW.job_id)
  RETURNING id INTO v_notif_id;

  PERFORM public.send_push_notification(
    v_job.poster_id, 
    'New Bid: ₹' || NEW.amount || ' 💰', 
    COALESCE(v_worker_name, 'A worker') || ' has placed a bid on your job.', 
    NEW.job_id, 'new_bid', v_notif_id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_bid
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_new_bid();


-- B. BID UPDATE (Counters & Acceptance)
CREATE OR REPLACE FUNCTION notify_on_bid_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job_title TEXT;
    v_poster_id UUID;
    v_target_user_id UUID;
    v_notif_title TEXT;
    v_notif_msg TEXT;
    v_notif_type TEXT := 'INFO';
    v_last_negotiator TEXT;
    v_notif_id UUID;
    v_push_type TEXT;
BEGIN
    SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;

    -- 1. Handle ACCEPTANCE
    IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
        v_target_user_id := NEW.worker_id;
        v_notif_title := 'You''re Hired! 🎉';
        v_notif_msg := 'Congratulations! You have been hired for "' || v_job_title || '".';
        v_notif_type := 'SUCCESS';
        v_push_type := 'bid_accepted';
        
        INSERT INTO notifications (user_id, type, title, message, related_job_id)
        VALUES (v_target_user_id, v_notif_type, v_notif_title, v_notif_msg, NEW.job_id)
        RETURNING id INTO v_notif_id;

        PERFORM public.send_push_notification(v_target_user_id, v_notif_title, v_notif_msg, NEW.job_id, v_push_type, v_notif_id);
    
    -- 2. Handle COUNTER OFFERS
    ELSIF OLD.status = 'PENDING' AND NEW.status = 'PENDING' THEN
        -- Check negotiation history change
        IF (jsonb_array_length(COALESCE(NEW.negotiation_history::jsonb, '[]'::jsonb)) > 
            jsonb_array_length(COALESCE(OLD.negotiation_history::jsonb, '[]'::jsonb))) THEN
            
            v_last_negotiator := UPPER(NEW.negotiation_history::jsonb -> -1 ->> 'by');
            
            IF (v_last_negotiator = 'WORKER') THEN
                v_target_user_id := v_poster_id;
                v_notif_title := 'New Counter Offer 📈';
                v_notif_msg := 'Worker countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
                v_push_type := 'counter_offer';
            ELSIF (v_last_negotiator = 'POSTER') THEN
                v_target_user_id := NEW.worker_id;
                v_notif_title := 'Counter Offer Received 📉';
                v_notif_msg := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
                v_push_type := 'counter_offer';
            ELSE
                RETURN NEW; -- Unknown negotiator
            END IF;

            INSERT INTO notifications (user_id, type, title, message, related_job_id)
            VALUES (v_target_user_id, 'INFO', v_notif_title, v_notif_msg, NEW.job_id)
            RETURNING id INTO v_notif_id;

            PERFORM public.send_push_notification(v_target_user_id, v_notif_title, v_notif_msg, NEW.job_id, v_push_type, v_notif_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_bid_update
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_update();


-- ============================================
-- 4. CHAT TRIGGER (With Push Integration)
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_job_title TEXT;
  v_notif_id UUID;
  v_preview TEXT;
BEGIN
  -- Skip if deleted
  IF NEW.is_deleted THEN RETURN NEW; END IF;

  -- Identify recipient
  SELECT 
    CASE WHEN NEW.sender_id = j.poster_id THEN b.worker_id ELSE j.poster_id END INTO v_recipient_id
  FROM jobs j
  LEFT JOIN bids b ON b.id = j.accepted_bid_id
  WHERE j.id = NEW.job_id;

  -- Validate
  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN RETURN NEW; END IF;

  -- Metadata
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;
  
  v_preview := '"' || COALESCE(v_job_title, 'Job') || '": ' || LEFT(NEW.text, 50) || CASE WHEN LENGTH(NEW.text) > 50 THEN '...' ELSE '' END;

  -- Insert Notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_recipient_id,
    'INFO',
    COALESCE(v_sender_name, 'Someone') || ' 💬',
    v_preview,
    NEW.job_id,
    false,
    NOW()
  )
  RETURNING id INTO v_notif_id;

  -- Send Push
  PERFORM public.send_push_notification(
    v_recipient_id, 
    COALESCE(v_sender_name, 'New Message') || ' 💬', 
    v_preview, 
    NEW.job_id, 
    'chat_message', 
    v_notif_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();

-- ============================================
-- 5. SUMMARY
-- ============================================
DO $$ BEGIN 
  RAISE NOTICE '✅ FINAL NOTIFICATION SYNC COMPLETE';
  RAISE NOTICE '-----------------------------------';
  RAISE NOTICE '1. Duplicate triggers on Bids and Chat removed.';
  RAISE NOTICE '2. trg_notify_on_new_bid -> notify_on_new_bid (INSERT)';
  RAISE NOTICE '3. trg_notify_on_bid_update -> notify_on_bid_update (UPDATE)';
  RAISE NOTICE '4. trg_notify_on_chat_message -> notify_on_chat_message (INSERT + Push)';
  RAISE NOTICE '-----------------------------------';
END $$;
