-- ============================================
-- ENABLE FCM PUSH SYNC (Connects DB to Edge Function)
-- ============================================
-- This script creates a trigger that fires whenever a notification is inserted.
-- It works for ALL notifications (Bids, Chat, System, etc.)
-- This ensures 'Sync' between the in-app notification list and Push Notifications.

-- 1. Enable pg_net extension (required for HTTP calls from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the internal push logic
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    -- TODO: REPLACE THESE TWO VALUES WITH YOUR ACTUAL SUPABASE SECRETS
    v_supabase_url TEXT := 'https://YOUR_PROJECT_ID.supabase.co'; 
    v_service_role_key TEXT := 'YOUR_SERVICE_ROLE_KEY';
BEGIN
    -- Only proceed if user has a push token (registered from mobile app)
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    IF v_push_token IS NOT NULL THEN
        -- Perform the HTTP POST to your Edge Function
        -- This is non-blocking (fire and forget)
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
        
        -- RAISE NOTICE '✅ Push notification queued for user %', NEW.user_id;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Capture error but don't fail the insert
    RAISE WARNING '❌ Failed to queue push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on the notifications table
-- This fires every time a new row is inserted
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();

DO $$
BEGIN
    RAISE NOTICE '✅ FCM Push Sync Trigger enabled!';
END $$;
