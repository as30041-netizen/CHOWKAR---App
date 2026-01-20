-- ============================================================================
-- FINAL_TRIGGER_CLEANUP.sql
-- ============================================================================
-- The previous script identified EXACTLY which triggers are left.
-- We will now delete them by name.
--
-- ZOMBIES FOUND:
-- 1. trg_chat_notification_push
-- 2. trg_notify_on_chat_message
-- 3. trigger_notify_on_chat_message (This is the one we want to KEEP)
-- ============================================================================

-- 1. DELETE THE ZOMBIES
DROP TRIGGER IF EXISTS trg_chat_notification_push ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_notify_on_chat_message ON public.chat_messages;

-- 2. VERIFY ONE LAST TIME
DO $$
DECLARE
    v_count INTEGER;
    v_names TEXT;
BEGIN
    SELECT COUNT(*), string_agg(trigger_name, ', ') 
    INTO v_count, v_names
    FROM information_schema.triggers
    WHERE event_object_table = 'chat_messages'
    AND trigger_schema = 'public'
    AND action_timing = 'AFTER'
    AND event_manipulation = 'INSERT';

    RAISE NOTICE '---------------------------------------------------';
    IF v_count = 1 THEN
        RAISE NOTICE '✅ SUCCESS: Exacty 1 Trigger remains: %', v_names;
    ELSE
        RAISE EXCEPTION '❌ FAILURE: Still have % triggers: %', v_count, v_names;
    END IF;
    RAISE NOTICE '---------------------------------------------------';
END $$;
