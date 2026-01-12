-- ============================================
-- FIX REALTIME SYNC AND BID COUNT V15
-- 1. Automatic Bid Count Trigger (Guarantees DB accuracy)
-- 2. Improved action_place_bid (Wallet-independent)
-- 3. Ensure all Bid updates trigger notifications/broadcasts
-- ============================================

-- A. CREATE TRIGGER TO KEEP BID_COUNT UPDATED
-- This is much more reliable than manual increments
CREATE OR REPLACE FUNCTION update_job_bid_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE jobs SET bid_count = bid_count + 1 WHERE id = NEW.job_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE jobs SET bid_count = GREATEST(0, bid_count - 1) WHERE id = OLD.job_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bid_count ON bids;
CREATE TRIGGER trg_update_bid_count
AFTER INSERT OR DELETE ON bids
FOR EACH ROW EXECUTE FUNCTION update_job_bid_count();

-- B. RECALCULATE EXISTING COUNTS (Correct any past sync errors)
UPDATE jobs j
SET bid_count = (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id);

-- C. NOTIFICATION TRIGGER FOR BIDS (Real-time Sync Helper)
-- Ensure every new bid or counter-offer creates a notification
-- Frontend listens to notifications for real-time alerts
CREATE OR REPLACE FUNCTION notify_on_bid_event()
RETURNS TRIGGER AS $$
DECLARE
    v_job_title TEXT;
    v_target_user_id UUID;
    v_notif_type TEXT;
    v_notif_title TEXT;
    v_notif_msg TEXT;
BEGIN
    -- Get job details
    SELECT title, poster_id INTO v_job_title, v_target_user_id FROM jobs WHERE id = NEW.job_id;

    IF (TG_OP = 'INSERT') THEN
        -- New Bid -> Notify Poster
        INSERT INTO notifications (user_id, type, title, message, related_job_id)
        VALUES (
            v_target_user_id,
            'NEW_BID',
            'New Bid Received! 💰',
            'Someone placed a bid of ₹' || NEW.amount || ' on "' || v_job_title || '".',
            NEW.job_id
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Check if it's a counter-offer
        IF (OLD.amount != NEW.amount OR OLD.message != NEW.message) THEN
            -- Determine who to notify
            -- If last turn was worker, notify poster. If last turn was poster, notify worker.
            -- Using negotiation_history to check who sent the last turn
            IF (NEW.negotiation_history -> -1 ->> 'by' = 'worker') THEN
                v_target_user_id := v_target_user_id; -- To poster
                v_notif_title := 'New Counter Offer 📈';
                v_notif_msg := 'Worker countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
            ELSE
                v_target_user_id := NEW.worker_id; -- To worker
                v_notif_title := 'Counter Offer Received 📉';
                v_notif_msg := 'Employer countered with ₹' || NEW.amount || ' for "' || v_job_title || '".';
            END IF;

            INSERT INTO notifications (user_id, type, title, message, related_job_id)
            VALUES (v_target_user_id, 'INFO', v_notif_title, v_notif_msg, NEW.job_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_bid_event ON bids;
CREATE TRIGGER trg_notify_on_bid_event
AFTER INSERT OR UPDATE ON bids
FOR EACH ROW EXECUTE FUNCTION notify_on_bid_event();

-- D. FIX ACTION_PLACE_BID (Denormalize everything for instant UI)
CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job RECORD;
    v_new_bid_id UUID;
    v_worker RECORD;
BEGIN
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job.status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job closed'); END IF;
    IF v_job.poster_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    SELECT * INTO v_worker FROM profiles WHERE id = auth.uid();

    INSERT INTO bids (
        job_id, worker_id, poster_id, amount, message, status, 
        worker_name, worker_phone, worker_photo, worker_location, 
        worker_rating, worker_latitude, worker_longitude,
        negotiation_history
    )
    VALUES (
        p_job_id, auth.uid(), v_job.poster_id, p_amount, p_message, 'PENDING',
        COALESCE(v_worker.name, 'Worker'), v_worker.phone, v_worker.profile_photo, v_worker.location,
        COALESCE(v_worker.rating, 5), v_worker.latitude, v_worker.longitude,
        jsonb_build_array(jsonb_build_object('amount', p_amount, 'by', 'worker', 'timestamp', extract(epoch from now())*1000))
    )
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V15 Realtime Sync Fix Deployed.';
END $$;
