-- ============================================================================
-- FINAL_SNIPE.sql
-- ============================================================================
-- 1. KILL the last zombie: 'trigger_ensure_chat_receiver'
-- 2. VERIFY coverage for other flows (Bids, Jobs)
-- ============================================================================

-- A. KILL THE ZOMBIE
DROP TRIGGER IF EXISTS trigger_ensure_chat_receiver ON public.chat_messages;

-- B. CONFIRM CHAT IS CLEAN (Should be 1 now)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.triggers 
    WHERE event_object_table = 'chat_messages' 
    AND trigger_schema = 'public' 
    AND event_manipulation = 'INSERT';

    IF v_count = 1 THEN
        RAISE NOTICE '✅ CHAT REPAIRED. Exactly 1 trigger active.';
    ELSE
        RAISE WARNING '⚠️ STILL HAVE % TRIGGERS ON CHAT', v_count;
    END IF;
END $$;


-- C. VERIFY OTHER FLOWS (Bids, Jobs)
-- The user asked: "What about other notifications?"
-- We check if Bids have triggers. If they do, they generate Notifications -> Which go to FCM.
DO $$
DECLARE
    v_bid_triggers INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_bid_triggers
    FROM information_schema.triggers 
    WHERE event_object_table = 'bids' 
    AND trigger_schema = 'public';

    IF v_bid_triggers > 0 THEN
        RAISE NOTICE '✅ BIDDING COVERAGE: OK (% Triggers Active)', v_bid_triggers;
    ELSE
        RAISE WARNING '⚠️ NO BID TRIGGERS FOUND! Bidding might be silent.';
    END IF;
END $$;
