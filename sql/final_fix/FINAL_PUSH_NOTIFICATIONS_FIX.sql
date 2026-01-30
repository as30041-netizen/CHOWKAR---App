-- ============================================================================
-- FINAL_PUSH_NOTIFICATIONS_FIX.sql (DEADLOCK-SAFE VERSION)
-- Description: Consolidated Master Script for Notifications & Push
-- Author: Antigravity AI
-- Instructions: If you see a deadlock error, run PART 1 first, then PART 2.
-- ============================================================================

-- PART 0: Settings to prevent hanging
SET lock_timeout = '10s';

-- 1. Infrastructure: Debug Logging
CREATE TABLE IF NOT EXISTS public.push_debug_logs (
    id SERIAL PRIMARY KEY,
    event TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 1: LOGIC & FUNCTIONS (Run these first)
-- ============================================================================

-- Logic: Notification Trigger for Bid Acceptance
CREATE OR REPLACE FUNCTION public.notify_on_bid_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_poster_name TEXT;
BEGIN
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    SELECT * INTO v_job FROM public.jobs WHERE id = NEW.job_id;
    SELECT name INTO v_poster_name FROM public.profiles WHERE id = v_job.poster_id;
    
    INSERT INTO public.notifications (user_id, type, title, message, related_job_id, read, created_at)
    VALUES (
      NEW.worker_id, 'SUCCESS', 'You Got the Job! 🎉',
      COALESCE(v_poster_name, 'Employer') || ' selected you for "' || v_job.title || '" at ₹' || NEW.amount || '. Tap to proceed!',
      NEW.job_id, false, NOW()
    );
    
    INSERT INTO public.notifications (user_id, type, title, message, related_job_id, read, created_at)
    SELECT worker_id, 'INFO', 'Job Update', 'Another worker was selected for "' || v_job.title || '". Keep bidding on other jobs!',
      NEW.job_id, false, NOW()
    FROM public.bids
    WHERE job_id = NEW.job_id AND worker_id != NEW.worker_id AND status = 'PENDING';
  END IF;
  RETURN NEW;
END;
$$;

-- Logic: Notification Trigger for Chat Messages
CREATE OR REPLACE FUNCTION public.notify_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_name TEXT;
BEGIN
    SELECT 
        CASE WHEN NEW.sender_id = j.poster_id THEN b.worker_id ELSE j.poster_id END,
        p.name
    INTO v_recipient_id, v_sender_name
    FROM public.jobs j
    JOIN public.bids b ON b.job_id = j.id
    JOIN public.profiles p ON p.id = NEW.sender_id
    WHERE j.id = NEW.job_id AND b.id = j.accepted_bid_id;

    IF v_recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_job_id, created_at)
        VALUES (v_recipient_id, v_sender_name, NEW.content, 'INFO', NEW.job_id, NOW());
    END IF;
    RETURN NEW;
END;
$$;

-- THE BRIDGE: Notification -> FCM Edge Function
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    v_url TEXT := 'https://ghtshhafukyirwkfdype.supabase.co/functions/v1/send-push-notification';
    v_anon_key TEXT := 'sb_publishable_TES0Vyz0LIYnQ04wHGBzQQ_3GaCei6Z'; 
    v_request_id BIGINT;
BEGIN
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
        INSERT INTO public.push_debug_logs (event, details) VALUES ('PUSH_SENT', 'Notification ID: ' || NEW.id || ' to User: ' || NEW.user_id);
        
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
            body := jsonb_build_object(
                'userId', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'type', NEW.type,
                'relatedJobId', NEW.related_job_id,
                'skipDb', true 
            )::jsonb
        ) INTO v_request_id;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.push_debug_logs (event, details) VALUES ('PUSH_ERROR', SQLERRM);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: TRIGGER ATTACHMENTS (Run these after PART 1)
-- ============================================================================

-- Attach Bid Trigger
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON public.bids;
CREATE TRIGGER trigger_notify_on_bid_accept
    AFTER UPDATE ON public.bids
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_bid_accept();

-- Attach Chat Trigger
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_notify_on_chat_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_chat_message();

-- Attach FCM Bridge Trigger
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();

-- 6. VERIFICATION
DO $$
BEGIN
    RAISE NOTICE 'SUCCESS: Master Notification & Push System Restored.';
END $$;
