-- ============================================================================
-- STOP_THE_NOISE.sql (Emergency Kill Switch)
-- ============================================================================
-- 1. DROPS the Push Notification Trigger immediately.
-- 2. This stops the Edge Function calls and the Push Spam.
-- 3. Then we can calmly look at the counts.
-- ============================================================================

-- 1. KILL THE TRIGGER
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;

-- 2. DIAGNOSTICS (Post-Mortem)
-- Let's see how many rows we generated
SELECT 'TOTAL_NOTIFICATIONS' as metric, COUNT(*) FROM notifications;
SELECT 'TOTAL_CHAT_MESSAGES' as metric, COUNT(*) FROM chat_messages;

-- 3. CHECK FOR ANY OTHER TRIGGERS ON NOTIFICATIONS
SELECT 
    trigger_name, 
    action_timing, 
    event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'notifications' 
AND trigger_schema = 'public';

DO $$
BEGIN
    RAISE NOTICE '✅ EMERGENCY STOP EXECUTED. Push Trigger removed.';
END $$;
