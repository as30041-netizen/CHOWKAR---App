-- ============================================
-- VERIFY NOTIFICATION SETUP
-- ============================================
-- Run this script to confirm that the notification triggers 
-- and functions are correctly installed and active.
-- ============================================

DO $$
DECLARE
    v_trg_count INTEGER;
    v_func_count INTEGER;
    v_push_config_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting Verification...';
    RAISE NOTICE '------------------------------------------------';

    -- 1. Verify Triggers
    SELECT COUNT(*) INTO v_trg_count
    FROM pg_trigger
    WHERE tgname IN (
        'trg_notify_on_new_bid', 
        'trg_notify_on_bid_update', 
        'trg_notify_on_chat_message'
    );

    IF v_trg_count = 3 THEN
        RAISE NOTICE '✅ All 3 Notification Triggers Found:';
        RAISE NOTICE '   - trg_notify_on_new_bid (Bids)';
        RAISE NOTICE '   - trg_notify_on_bid_update (Counters/Accept)';
        RAISE NOTICE '   - trg_notify_on_chat_message (Chat)';
    ELSE
        RAISE WARNING '❌ Missing Triggers! Found %/3. Please re-run FINAL_NOTIFICATION_SYNC.sql', v_trg_count;
    END IF;

    -- 2. Verify Functions
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

    -- 3. Verify Push Config (Optional but good to know)
    SELECT COUNT(*) INTO v_push_config_count 
    FROM app_config 
    WHERE key IN ('supabase_url', 'service_role_key');

    IF v_push_config_count = 2 THEN
        RAISE NOTICE '✅ Push Notification Config Found (URL + Key).';
    ELSE
        RAISE NOTICE '⚠️ Push Notification Config Missing. Push notifications to mobile checks will fail silently.';
        RAISE NOTICE '   (This is fine for local dev, but needed for production)';
    END IF;

    RAISE NOTICE '------------------------------------------------';
    RAISE NOTICE 'Verification Complete.';
END $$;
