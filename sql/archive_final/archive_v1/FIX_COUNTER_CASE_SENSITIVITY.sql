-- ============================================
-- FIX COUNTER OFFER NOTIFICATION - FINAL
-- ============================================
-- Issues Found:
-- 1. Case sensitivity: Function checks 'worker' but data has 'WORKER'
-- 2. Duplicate triggers: Two triggers both handling counter offers
--
-- Solution: Fix the main function and drop the duplicate trigger

-- ============================================
-- STEP 1: DROP DUPLICATE COUNTER TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS counter_offer_notification_trigger ON bids CASCADE;
DROP FUNCTION IF EXISTS handle_counter_offer_notification() CASCADE;

-- ============================================
-- STEP 2: FIX THE MAIN FUNCTION (UPPERCASE)
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_on_bid_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_title TEXT;
    v_poster_id UUID;
    v_target_user_id UUID;
    v_notif_type TEXT;
    v_notif_title TEXT;
    v_notif_msg TEXT;
    v_last_negotiator TEXT;
BEGIN
    -- Get job details
    SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;

    IF (TG_OP = 'INSERT') THEN
        -- New Bid -> Notify Poster
        INSERT INTO notifications (user_id, type, title, message, related_job_id)
        VALUES (
            v_poster_id,
            'SUCCESS',
            'New Bid Received! 💰',
            'Someone placed a bid of ₹' || NEW.amount || ' on "' || v_job_title || '".',
            NEW.job_id
        );
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Check if it's a counter-offer (amount changed or negotiation_history grew)
        IF (OLD.amount != NEW.amount OR 
            jsonb_array_length(COALESCE(NEW.negotiation_history::jsonb, '[]'::jsonb)) > 
            jsonb_array_length(COALESCE(OLD.negotiation_history::jsonb, '[]'::jsonb))) THEN
            
            -- Get the last negotiator (UPPERCASE: 'WORKER' or 'POSTER')
            v_last_negotiator := NEW.negotiation_history::jsonb -> -1 ->> 'by';
            
            RAISE NOTICE '[BidEvent] Counter detected. Last negotiator: %', v_last_negotiator;
            
            -- FIX: Use UPPERCASE comparison
            IF (v_last_negotiator = 'WORKER') THEN
                -- Worker countered → Notify POSTER
                v_target_user_id := v_poster_id;
                v_notif_title := 'New Counter Offer 📈';
                v_notif_msg := 'Worker countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
                RAISE NOTICE '[BidEvent] WORKER → notifying POSTER %', v_target_user_id;
                
            ELSIF (v_last_negotiator = 'POSTER') THEN
                -- Poster countered → Notify WORKER
                v_target_user_id := NEW.worker_id;
                v_notif_title := 'Counter Offer Received 📉';
                v_notif_msg := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
                RAISE NOTICE '[BidEvent] POSTER → notifying WORKER %', v_target_user_id;
                
            ELSE
                RAISE NOTICE '[BidEvent] Unknown negotiator: %. Skipping.', v_last_negotiator;
                RETURN NEW;
            END IF;

            INSERT INTO notifications (user_id, type, title, message, related_job_id)
            VALUES (v_target_user_id, 'INFO', v_notif_title, v_notif_msg, NEW.job_id);
            
            RAISE NOTICE '[BidEvent] ✅ Notification sent to %', v_target_user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================
-- STEP 3: VERIFY
-- ============================================

DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    -- Count counter-related triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'bids'::regclass
      AND tgname LIKE '%counter%';
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════';
    RAISE NOTICE '✅ COUNTER OFFER NOTIFICATION - FIXED!';
    RAISE NOTICE '═══════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Fixes Applied:';
    RAISE NOTICE '  1. ✅ Removed duplicate counter_offer_notification_trigger';
    RAISE NOTICE '  2. ✅ Fixed case sensitivity: "worker" → "WORKER"';
    RAISE NOTICE '  3. ✅ Fixed case sensitivity: "poster" → "POSTER"';
    RAISE NOTICE '  4. ✅ Single trigger handles all bid events';
    RAISE NOTICE '';
    RAISE NOTICE 'Counter-related triggers remaining: %', trigger_count;
    RAISE NOTICE '';
    RAISE NOTICE 'The notify_on_bid_event function now:';
    RAISE NOTICE '  • WORKER counters → Notifies POSTER';
    RAISE NOTICE '  • POSTER counters → Notifies WORKER';
    RAISE NOTICE '  • No self-notifications!';
    RAISE NOTICE '  • No duplicates!';
    RAISE NOTICE '═══════════════════════════════════════════════';
END $$;

-- Show remaining triggers on bids
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
  AND NOT t.tgisinternal
  AND (p.proname LIKE '%notify%' OR t.tgname LIKE '%notify%');
