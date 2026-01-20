-- ============================================================================
-- ENABLE_PUSH_NOTIFICATIONS.sql
-- Connects Database Notifications to FCM Push via Edge Functions
-- ============================================================================

-- 1. Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the push trigger function
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    -- Note: Edge function uses its own internal credentials for FCM
    -- We just need to call it with the user ID and notification details
BEGIN
    -- 1. Check if the recipient has a push token registered
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    -- 2. If token exists, call the Edge Function
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
        PERFORM net.http_post(
            url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
            ),
            body := jsonb_build_object(
                'userId', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'type', COALESCE(NEW.type, 'INFO'),
                'relatedJobId', NEW.related_job_id
            )::text
        );
        RAISE NOTICE 'Push notification queued for user %', NEW.user_id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Don't block the database operation if push fails
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();

-- ============================================================================
-- HOW TO DEPLOY:
-- 1. Run this script in Supabase SQL Editor.
-- 2. Ensure your Firebase Secrets are set in Supabase (Dashboard > Edge Functions > Secrets).
-- ============================================================================
