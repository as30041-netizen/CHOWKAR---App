-- ============================================
-- CREATE APP_CONFIG TABLE & VERIFY NOTIFICATIONS
-- ============================================
-- 1. Create app_config table if missing
-- 2. Verify Triggers & Functions
-- ============================================

-- 1. Create Config Table
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Admin only)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 2. Run Verification Logic
DO $$
DECLARE
    v_trg_count INTEGER;
    v_func_count INTEGER;
    v_push_config_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting Verification...';
    RAISE NOTICE '------------------------------------------------';

    -- Verify Triggers (Should be 3)
    SELECT COUNT(*) INTO v_trg_count
    FROM pg_trigger
    WHERE tgname IN (
        'trg_notify_on_new_bid', 
        'trg_notify_on_bid_update', 
        'trg_notify_on_chat_message'
    );

    IF v_trg_count = 3 THEN
        RAISE NOTICE '✅ All 3 Notification Triggers Found.';
    ELSE
        RAISE WARNING '❌ Missing Triggers! Found %/3. Please re-run FINAL_NOTIFICATION_SYNC.sql', v_trg_count;
    END IF;

    -- Verify Functions (Should be 4)
    SELECT COUNT(*) INTO v_func_count
    FROM pg_proc
    WHERE proname IN (
        'notify_on_new_bid',
        'notify_on_bid_update',
        'notify_on_chat_message',
        'send_push_notification'
    );

    IF v_func_count = 4 THEN
         RAISE NOTICE '✅ All 4 Notification Functions Found.';
    ELSE
         RAISE WARNING '❌ Missing Functions! Found %/4.', v_func_count;
    END IF;

    -- Verify Push Config
    SELECT COUNT(*) INTO v_push_config_count 
    FROM app_config 
    WHERE key IN ('supabase_url', 'service_role_key');

    IF v_push_config_count = 2 THEN
        RAISE NOTICE '✅ Push Notification Config Found.';
    ELSE
        RAISE NOTICE '⚠️ Push Config Missing in app_config table.';
        RAISE NOTICE '   Push notifications to mobile will NOT work until you add these values.';
        RAISE NOTICE '   Example: INSERT INTO app_config (key, value) VALUES (''supabase_url'', ''...'');';
    END IF;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'Verification Complete.';
END $$;
