-- ============================================================================
-- NUKE_AND_RESTORE_CHAT_TRIGGERS.sql
-- ============================================================================
-- PROBLEM: You have "Double Notifications" because of zombie triggers.
-- SOLUTION: This script deletes EVERY known trigger variation and installs JUST ONE.
-- ============================================================================

-- 1. AGGRESSIVE DROPS (Kill everything on chat_messages)
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON public.chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON public.chat_messages;
DROP TRIGGER IF EXISTS notify_chat_message ON public.chat_messages;
DROP TRIGGER IF EXISTS notify_on_new_message ON public.chat_messages;
DROP TRIGGER IF EXISTS on_message_insert ON public.chat_messages;
DROP TRIGGER IF EXISTS chat_message_notification ON public.chat_messages;
-- (Just in case)
DROP TRIGGER IF EXISTS "notify_on_new_message" ON public.chat_messages;

-- 2. RESTORE THE ONE TRUE TRIGGER
-- (We use the function 'notify_on_chat_message' which we created in DEBUG_AND_RESTORE_PUSH_CHAIN.sql)
CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_chat_message();

-- 3. VERIFY
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
        RAISE NOTICE '✅ SUCCESS: Only 1 Trigger remains: %', v_names;
    ELSE
        RAISE EXCEPTION '❌ FAILURE: Still have % triggers: %', v_count, v_names;
    END IF;
    RAISE NOTICE '---------------------------------------------------';
END $$;
