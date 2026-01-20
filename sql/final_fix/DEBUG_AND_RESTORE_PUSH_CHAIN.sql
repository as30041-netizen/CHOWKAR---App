-- ============================================================================
-- DEBUG_AND_RESTORE_PUSH_CHAIN.sql
-- ============================================================================
-- 1. Creates a Debug Log table to verify if triggers are firing.
-- 2. RESTORES the missing Chat -> Notification trigger (Critical Fix).
-- 3. RESTORES the Notification -> FCM Edge Function trigger (with Logging).
-- ============================================================================

-- A. Create Debug Log Table
CREATE TABLE IF NOT EXISTS public.push_debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. ENABLE pg_net for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ============================================================================
-- PART 1: CHAT -> NOTIFICATION TRIGGER (THE MISSING LINK)
-- Checks for blocking, resolves recipient, inserts into 'notifications' table.
-- ============================================================================

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
  v_blocking_exists BOOLEAN;
BEGIN
  -- LOGGING
  INSERT INTO push_debug_logs (event, details) VALUES ('CHAT_TRIGGER', 'New message from ' || NEW.sender_id);

  -- 1. Skip if message is soft-deleted
  IF NEW.is_deleted THEN
    RETURN NEW;
  END IF;

  -- 2. Identify Recipient
  SELECT 
    CASE 
      WHEN NEW.sender_id = j.poster_id THEN b.worker_id 
      ELSE j.poster_id 
    END INTO v_recipient_id
  FROM jobs j
  LEFT JOIN bids b ON b.id = j.accepted_bid_id
  WHERE j.id = NEW.job_id;

  -- 3. Validate Recipient
  IF v_recipient_id IS NULL THEN
    INSERT INTO push_debug_logs (event, details) VALUES ('CHAT_ERROR', 'No recipient found for job ' || NEW.job_id);
    RETURN NEW; 
  END IF;

  -- 4. Anti-Self-Notification
  IF v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- 5. BLOCKING CHECK
  SELECT EXISTS (
    SELECT 1 FROM user_blocks 
    WHERE blocker_id = v_recipient_id AND blocked_id = NEW.sender_id
  ) INTO v_blocking_exists;

  IF v_blocking_exists THEN
    INSERT INTO push_debug_logs (event, details) VALUES ('CHAT_BLOCKED', 'User is blocked');
    RETURN NEW;
  END IF;

  -- 6. Get Metadata
  SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

  -- 7. Insert Notification
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_recipient_id,
    'INFO',
    COALESCE(v_sender_name, 'Someone') || ' 💬',
    CASE 
      WHEN v_job_title IS NOT NULL THEN '"' || v_job_title || '": ' 
      ELSE '' 
    END || LEFT(NEW.text, 50) || CASE WHEN LENGTH(NEW.text) > 50 THEN '...' ELSE '' END,
    NEW.job_id,
    false,
    NOW()
  );
  
  INSERT INTO push_debug_logs (event, details) VALUES ('NOTIFICATION_CREATED', 'For user: ' || v_recipient_id);

  RETURN NEW;
END;
$$;

-- Drop old/duplicate triggers
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON chat_messages;
DROP TRIGGER IF EXISTS notify_chat_message ON chat_messages;

-- Create Canoncial Trigger
CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_on_chat_message();


-- ============================================================================
-- PART 2: NOTIFICATION -> FCM EDGE FUNCTION TRIGGER (THE BRIDGE)
-- Listens to 'notifications' table and fires HTTP request to Edge Function.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    v_url TEXT := 'https://ghtshhafukyirwkfdype.supabase.co/functions/v1/send-push-notification';
    v_anon_key TEXT := 'sb_publishable_TES0Vyz0LIYnQ04wHGBzQQ_3GaCei6Z'; -- Hardcoded for reliability
    v_request_id BIGINT;
BEGIN
    INSERT INTO push_debug_logs (event, details) VALUES ('PUSH_TRIGGER', 'Notification ID: ' || NEW.id);

    -- 1. Check if the recipient has a push token registered
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    -- 2. If token exists, call the Edge Function
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
        INSERT INTO push_debug_logs (event, details) VALUES ('PUSH_TOKEN_FOUND', 'Token starts with: ' || LEFT(v_push_token, 10));
        
        -- pg_net http_post returns the request_id
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
                'userId', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'type', COALESCE(NEW.type, 'INFO'),
                'relatedJobId', NEW.related_job_id
            )::jsonb
        ) INTO v_request_id;
        
        INSERT INTO push_debug_logs (event, details) VALUES ('PUSH_SENT', 'RequestQueued ID: ' || v_request_id);
    ELSE
        INSERT INTO push_debug_logs (event, details) VALUES ('PUSH_SKIPPED', 'No Token for User: ' || NEW.user_id);
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO push_debug_logs (event, details) VALUES ('PUSH_ERROR', SQLERRM);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-Attach the trigger
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();

-- ============================================================================
-- VERIFICATION VIEW
-- ============================================================================
-- SELECT * FROM push_debug_logs ORDER BY created_at DESC;
