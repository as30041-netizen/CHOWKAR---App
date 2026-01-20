-- ============================================================================
-- FIX_DUPLICATE_CHAT_NOTIFICATIONS.sql
-- ============================================================================
-- The user reported "too many notifications".
-- DIAGNOSIS: We likely have TWO active triggers on 'chat_messages':
-- 1. 'notify_on_new_message' (from MASTER_NOTIFICATION_FIX.sql)
-- 2. 'trigger_notify_on_chat_message' (from DEBUG_AND_RESTORE_PUSH_CHAIN.sql)
--
-- This script removes the redundant one to ensure singular flow.
-- ============================================================================

-- 1. DROP the redundant trigger form Master Fix
DROP TRIGGER IF EXISTS notify_on_new_message ON public.chat_messages;

-- 2. Just to be safe, drop other potential legacy names we might have missed
DROP TRIGGER IF EXISTS on_chat_message_insert ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_chat_notification ON public.chat_messages;

-- 3. Verify we have exactly ONE trigger left
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.triggers
    WHERE event_object_table = 'chat_messages'
    AND trigger_schema = 'public'
    AND action_timing = 'AFTER'
    AND event_manipulation = 'INSERT';

    IF v_count = 1 THEN
        RAISE NOTICE '✅ SUCCESS: Exacty 1 trigger remains on chat_messages.';
    ELSIF v_count = 0 THEN
        RAISE WARNING '⚠️ WARNING: No triggers found! Please re-run DEBUG_AND_RESTORE_PUSH_CHAIN.sql';
    ELSE
        RAISE WARNING '⚠️ WARNING: Still have % triggers! Check duplicates manually.', v_count;
    END IF;
END $$;
