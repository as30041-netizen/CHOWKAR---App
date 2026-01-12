-- ============================================
-- FIX DUPLICATE BID NOTIFICATIONS
-- Keep only notify_poster_on_new_bid for new bids
-- ============================================

-- 1. Show current triggers on bids table (before)
SELECT 
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'bids'::regclass
ORDER BY tgname;

-- 2. DROP duplicate triggers for new bid notifications
-- We'll keep notify_poster_on_new_bid (clean, has worker name)

-- Drop trigger for notify_on_bid_created (duplicate)
DROP TRIGGER IF EXISTS trigger_notify_on_bid_created ON bids;
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP TRIGGER IF EXISTS trg_notify_on_bid_created ON bids;

-- 3. Modify notify_on_bid_event to SKIP INSERT (only handle counter-offers on UPDATE)
CREATE OR REPLACE FUNCTION notify_on_bid_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_title TEXT;
    v_poster_id UUID;
    v_target_user_id UUID;
    v_notif_title TEXT;
    v_notif_msg TEXT;
    v_last_negotiator TEXT;
BEGIN
    -- Get job details
    SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;

    -- REMOVED: INSERT case - now handled by notify_poster_on_new_bid
    -- Only handle UPDATE (counter-offers)
    IF (TG_OP = 'UPDATE') THEN
        -- Check if it's a counter-offer (negotiation_history grew)
        IF (jsonb_array_length(COALESCE(NEW.negotiation_history::jsonb, '[]'::jsonb)) > 
            jsonb_array_length(COALESCE(OLD.negotiation_history::jsonb, '[]'::jsonb))) THEN
            
            -- Get the last negotiator (could be lowercase or uppercase)
            v_last_negotiator := UPPER(NEW.negotiation_history::jsonb -> -1 ->> 'by');
            
            RAISE NOTICE '[BidEvent] Counter detected. Last negotiator: %', v_last_negotiator;
            
            IF (v_last_negotiator = 'WORKER') THEN
                -- Worker countered → Notify POSTER
                v_target_user_id := v_poster_id;
                v_notif_title := 'New Counter Offer 📈';
                v_notif_msg := 'Worker countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
                
            ELSIF (v_last_negotiator = 'POSTER') THEN
                -- Poster countered → Notify WORKER
                v_target_user_id := NEW.worker_id;
                v_notif_title := 'Counter Offer Received 📉';
                v_notif_msg := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
                
            ELSE
                RAISE NOTICE '[BidEvent] Unknown negotiator: %. Skipping.', v_last_negotiator;
                RETURN NEW;
            END IF;

            INSERT INTO notifications (user_id, type, title, message, related_job_id)
            VALUES (v_target_user_id, 'INFO', v_notif_title, v_notif_msg, NEW.job_id);
            
            RAISE NOTICE '[BidEvent] ✅ Counter notification sent to %', v_target_user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Show current triggers (after)
SELECT 
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'bids'::regclass
ORDER BY tgname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ DUPLICATE BID NOTIFICATION TRIGGERS FIXED';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New bid → notify_poster_on_new_bid ONLY';
  RAISE NOTICE 'Counter offer → notify_on_bid_event (UPDATE only)';
  RAISE NOTICE '';
END $$;
