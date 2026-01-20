-- ============================================================================
-- RESET_AND_INIT_NOTIFICATIONS.sql (Factory Reset)
-- ============================================================================
-- Use this script to WIPE the slate clean and install the Correct System.
-- This prevents "Loops", "Double Messages", and "Ghost Triggers".
-- ============================================================================

-- ============================================
-- STEP 1: DROP *EVERYTHING* (Aggressive Cleanup)
-- ============================================

-- A. Chat Triggers (The Source)
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON public.chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON public.chat_messages;
DROP TRIGGER IF EXISTS notify_chat_message ON public.chat_messages;
DROP TRIGGER IF EXISTS notify_on_new_message ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_chat_notification_push ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_notify_on_chat_message ON public.chat_messages;

-- B. Notification Triggers (The Pipeline)
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
DROP TRIGGER IF EXISTS push_notification_trigger ON public.notifications;
DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;


-- ============================================
-- STEP 2: RE-INSTALL THE *CORRECT* TRIGGERS
-- ============================================

-- A. Install Chat -> Notification Trigger
CREATE TRIGGER trigger_notify_on_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_chat_message();

-- B. Install Notification -> FCM Trigger
CREATE TRIGGER on_notification_created_fcm_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_fcm_push_notification();


-- ============================================
-- STEP 3: VERIFICATION
-- ============================================
DO $$
DECLARE
    v_chat_count INTEGER;
    v_push_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_chat_count 
    FROM information_schema.triggers 
    WHERE event_object_table = 'chat_messages' 
    AND trigger_schema = 'public' 
    AND event_manipulation = 'INSERT';

    SELECT COUNT(*) INTO v_push_count 
    FROM information_schema.triggers 
    WHERE event_object_table = 'notifications' 
    AND trigger_schema = 'public' 
    AND event_manipulation = 'INSERT';

    IF v_chat_count = 1 AND v_push_count = 1 THEN
        RAISE NOTICE '✅ SUCCESS: System Reset. 1 Chat Trigger, 1 Push Trigger. Ready.';
    ELSE
        RAISE EXCEPTION '❌ FAILURE: Cleanup Failed. Chat: %, Push: %', v_chat_count, v_push_count;
    END IF;
END $$;
