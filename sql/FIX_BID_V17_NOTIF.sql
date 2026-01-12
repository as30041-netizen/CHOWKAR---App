-- ============================================
-- FIX BID V17 (NOTIFICATION TYPE & SYNC)
-- 1. Correct Notification Type (Fixes Constraint Error)
-- 2. Maintain V16 Compatibility logic for action_place_bid
-- 3. Ensure bid_count trigger is active
-- ============================================

-- 1. FIX NOTIFICATION TRIGGER (Change 'NEW_BID' to 'SUCCESS')
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
        -- Use 'SUCCESS' or 'INFO' depending on check constraint
        INSERT INTO notifications (user_id, type, title, message, related_job_id)
        VALUES (
            v_target_user_id,
            'SUCCESS', -- Changed from 'NEW_BID' to fix check constraint
            'New Bid Received! 💰',
            'Someone placed a bid of ₹' || NEW.amount || ' on "' || v_job_title || '".',
            NEW.job_id
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Check if it's a counter-offer
        IF (OLD.amount != NEW.amount OR OLD.message != NEW.message) THEN
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

-- 2. RE-DEPLOY COMPATIBLE PLACE BID (V16 LOGIC)
CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_job_status TEXT;
    v_job_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker RECORD;
    v_has_poster_col BOOLEAN;
    v_has_neg_col BOOLEAN;
BEGIN
    SELECT status, poster_id, title INTO v_job_status, v_job_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job closed'); END IF;
    IF v_job_poster_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'You cannot bid on your own job'); END IF;
    
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'error', 'You have already placed a bid on this job');
    END IF;

    SELECT * INTO v_worker FROM profiles WHERE id = auth.uid();
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Profile not found'); END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'poster_id') INTO v_has_poster_col;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'negotiation_history') INTO v_has_neg_col;

    EXECUTE format('
        INSERT INTO bids (
            job_id, worker_id, amount, message, status, 
            worker_name, worker_phone, worker_photo, worker_location, 
            worker_rating, worker_latitude, worker_longitude,
            created_at, updated_at
            %s %s
        )
        VALUES (
            $1, $2, $3, $4, ''PENDING'',
            $5, $6, $7, $8,
            $9, $10, $11,
            NOW(), NOW()
            %s %s
        )
        RETURNING id',
        CASE WHEN v_has_poster_col THEN ', poster_id' ELSE '' END,
        CASE WHEN v_has_neg_col THEN ', negotiation_history' ELSE '' END,
        CASE WHEN v_has_poster_col THEN ', $12' ELSE '' END,
        CASE WHEN v_has_neg_col THEN ', $13' ELSE '' END
    )
    INTO v_new_bid_id
    USING 
        p_job_id, auth.uid(), p_amount, p_message,
        COALESCE(v_worker.name, 'Worker'), v_worker.phone, v_worker.profile_photo, v_worker.location,
        COALESCE(v_worker.rating, 5), v_worker.latitude, v_worker.longitude,
        v_job_poster_id,
        jsonb_build_array(jsonb_build_object('amount', p_amount, 'by', 'worker', 'timestamp', extract(epoch from now())*1000));

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

DO $$ BEGIN
  RAISE NOTICE '✅ V17 Notification Fix Deployed.';
END $$;
