-- ============================================
-- PUSH NOTIFICATIONS SETUP
-- ============================================

-- 1. Add push token column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;

-- 3. Function to get push token
CREATE OR REPLACE FUNCTION get_push_token(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT push_token INTO v_token FROM profiles WHERE id = p_user_id;
    RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION get_push_token TO authenticated;

-- 4. Trigger to queue push notification when notification is created
-- Note: This uses pg_net extension (if available) to call the Edge Function
-- If pg_net is not available, the push will rely on client-side logic

-- First check if pg_net is available
DO $$
BEGIN
    -- Try to create the function that uses pg_net
    EXECUTE '
    CREATE OR REPLACE FUNCTION trigger_push_notification()
    RETURNS TRIGGER AS $func$
    DECLARE
        v_token TEXT;
        v_supabase_url TEXT;
    BEGIN
        -- Get push token
        SELECT push_token INTO v_token FROM profiles WHERE id = NEW.user_id;
        
        -- If user has a token, send push via Edge Function
        IF v_token IS NOT NULL THEN
            -- Get Supabase URL from current connection (or hardcode if needed)
            v_supabase_url := current_setting(''request.headers'', true)::json->>''host'';
            
            -- Queue the HTTP request (non-blocking)
            -- This requires pg_net extension
            PERFORM net.http_post(
                url := ''https://'' || v_supabase_url || ''/functions/v1/send-push-notification'',
                body := jsonb_build_object(
                    ''userId'', NEW.user_id,
                    ''title'', NEW.title,
                    ''body'', NEW.message
                )::text,
                headers := jsonb_build_object(''Content-Type'', ''application/json'')
            );
        END IF;
        
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    ';
    
    -- Create the trigger
    EXECUTE 'DROP TRIGGER IF EXISTS on_notification_send_push ON notifications';
    EXECUTE 'CREATE TRIGGER on_notification_send_push AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION trigger_push_notification()';
    
    RAISE NOTICE 'Push notification trigger created with pg_net';
EXCEPTION WHEN OTHERS THEN
    -- pg_net not available, skip the trigger
    RAISE NOTICE 'pg_net extension not available. Push notifications will use client-side logic.';
END $$;
