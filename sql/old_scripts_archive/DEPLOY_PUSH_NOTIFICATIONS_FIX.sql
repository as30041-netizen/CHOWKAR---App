-- ============================================================================
-- DEPLOY_PUSH_NOTIFICATIONS_FIX.sql
-- Fixes the FCM Trigger to work in Background/Internal Contexts (No Request Headers required)
-- ============================================================================

-- 1. Enable pg_net extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the ROBUST push trigger function
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    v_url TEXT := 'https://ghtshhafukyirwkfdype.supabase.co/functions/v1/send-push-notification';
    v_anon_key TEXT := 'sb_publishable_TES0Vyz0LIYnQ04wHGBzQQ_3GaCei6Z'; -- Hardcoded from .env for reliability
BEGIN
    -- 1. Check if the recipient has a push token registered
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    -- 2. If token exists, call the Edge Function
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
        PERFORM net.http_post(
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

-- 3. Re-Attach the trigger (Ensure it's active)
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();

-- 4. Verify it's working by adding a test log (Optional)
-- INSERT INTO notifications (user_id, title, message, type) VALUES ('<USER_ID>', 'Test', 'Background Push Test', 'INFO');
