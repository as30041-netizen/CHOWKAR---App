-- ============================================================================
-- 🚀 FINAL PUSH NOTIFICATIONS RESTORATION (CREDENTIAL-SAFE)
-- ============================================================================
-- This script fixes background push notifications by ensuring the trigger
-- uses the correct SERVICE_ROLE key to call the Edge Function.
-- ============================================================================

-- 1. EXTENSION & LOGGING SETUP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.push_debug_logs (
    id BIGSERIAL PRIMARY KEY,
    event TEXT NOT NULL,
    details TEXT,
    http_request_id BIGINT,
    http_status_code INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROBUST MIGRATION: Ensure columns exist if table was already created in an old version
DO $$ 
BEGIN 
    -- Add http_request_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='push_debug_logs' AND column_name='http_request_id') THEN
        ALTER TABLE public.push_debug_logs ADD COLUMN http_request_id BIGINT;
    END IF;
    
    -- Add http_status_code if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='push_debug_logs' AND column_name='http_status_code') THEN
        ALTER TABLE public.push_debug_logs ADD COLUMN http_status_code INTEGER;
    END IF;
END $$;

-- 2. MASTER TRIGGER FUNCTION
-- This replaces all previous notification triggers to prevent loops
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    v_url TEXT;
    v_service_role_key TEXT;
    v_request_id BIGINT;
BEGIN
    -- CONFIGURATION
    v_url := 'https://ghtshhafukyirwkfdype.supabase.co/functions/v1/send-push-notification';
    
    -- IMPORTANT: This script should have your service_role key already pasted here.
    -- If it says 'PASTE_HERE', please paste your key from Supabase Settings -> API.
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHNoaGFmdWt5aXJ3a2ZkeXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5OTU0OSwiZXhwIjoyMDgzMzc1NTQ5fQ.9QodJ5Rrd7GCHK-MX38D4StXyLl1vufcTWt8EXybbo8';

    -- 1. Check if recipient has a push token
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
        -- Log attempt
        INSERT INTO public.push_debug_logs (event, details) 
        VALUES ('PUSH_ATTEMPT', 'Sending Notification ID: ' || NEW.id || ' to User: ' || NEW.user_id);
        
        -- Call Edge Function via pg_net (Asynchronous)
        -- We pass 'skipDb': true to prevent the Edge Function from creating a loop
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_service_role_key
            ),
            body := jsonb_build_object(
                'userId', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'type', COALESCE(NEW.type, 'INFO'),
                'relatedJobId', NEW.related_job_id,
                'skipDb', true 
            )::jsonb
        ) INTO v_request_id;

        -- Link request ID for debugging
        UPDATE public.push_debug_logs 
        SET http_request_id = v_request_id 
        WHERE id = (SELECT MAX(id) FROM public.push_debug_logs);
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.push_debug_logs (event, details) 
    VALUES ('PUSH_ERROR', SQLERRM);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY TRIGGER TO NOTIFICATIONS TABLE
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
CREATE TRIGGER on_notification_created_fcm_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_fcm_push_notification();
