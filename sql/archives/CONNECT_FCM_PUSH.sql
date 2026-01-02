-- ============================================
-- CONNECT DATABASE TO FCM PUSH (Killed App Support)
-- This script connects your database triggers to your FCM Edge Function
-- ============================================

-- 1. Enable pg_net extension (required for HTTP calls from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the internal push logic
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    v_supabase_url TEXT := 'https://your-project-id.supabase.co'; -- TODO: REPLACE WITH YOUR SUPABASE URL
    v_service_role_key TEXT := 'your-service-role-key'; -- TODO: REPLACE WITH YOUR SERVICE ROLE KEY
BEGIN
    -- Only proceed if user has a push token
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    IF v_push_token IS NOT NULL THEN
        -- Perform the HTTP POST to your Edge Function
        -- This is non-blocking (asynchronous)
        PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_service_role_key
            ),
            body := jsonb_build_object(
                'userId', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'data', jsonb_build_object(
                    'jobId', COALESCE(NEW.related_job_id::text, ''),
                    'type', COALESCE(NEW.type, ''),
                    'notificationId', NEW.id::text
                )
            )::text
        );
        
        RAISE NOTICE '✅ Push notification queued for user %', NEW.user_id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Capture error but don't fail the insert
    RAISE WARNING '❌ Failed to queue push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on the notifications table
-- This fires every time a new row is inserted (from bid triggers, chat triggers, etc.)
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();

-- ============================================
-- IMPORTANT INSTRUCTIONS
-- ============================================
-- 1. Go to your Supabase Project Settings > API
-- 2. Copy "Project URL" and "service_role" key
-- 3. Replace the placeholders in the function above (lines 11 and 12)
-- 4. Run this script in the Supabase SQL Editor
--
-- Why This Works:
-- Unlike LocalNotifications which need the app open, this script calls your
-- FCM Edge Function directly from the database. FCM will then deliver the 
-- notification to the device even if the app is FORCE CLOSED (Killed).
-- ============================================
