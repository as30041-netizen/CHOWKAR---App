-- ============================================================================
-- SECURE NEGOTIATION LOGIC
-- Enforces business rules for Counters and Rejections via RPCs
-- Replaces loose RLS-based direct updates
-- ============================================================================

-- 1. ACTION: COUNTER BID
-- Called by either Worker or Poster to propose a new price
CREATE OR REPLACE FUNCTION action_counter_bid(
    p_bid_id UUID,
    p_amount NUMERIC,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the function owner (admin)
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
    v_user_role TEXT;
    v_negotiation_entry JSONB;
BEGIN
    -- A. Input Validation
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- B. Verify Bid Existence & Ownership
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bid not found');
    END IF;

    -- C. Verify Job Status
    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    IF v_job.status != 'OPEN' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job is no longer open');
    END IF;

    -- D. Determine Role & Authorize
    IF auth.uid() = v_bid.worker_id THEN
        v_user_role := 'WORKER';
    ELSIF auth.uid() = v_job.poster_id THEN
        v_user_role := 'POSTER';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- E. Construct Negotiation Entry
    v_negotiation_entry := jsonb_build_object(
        'by', v_user_role,
        'amount', p_amount,
        'message', p_message,
        'at', extract(epoch from now()) * 1000 -- JS timestamp
    );

    -- F. Update Bid
    -- Append logic handles null history gracefully
    UPDATE bids
    SET 
        amount = p_amount,
        message = p_message, -- Update main message to reflect latest counter
        negotiation_history = COALESCE(negotiation_history, '[]'::jsonb) || v_negotiation_entry,
        status = 'PENDING',  -- Reset status to PENDING if it was something else
        updated_at = now()
    WHERE id = p_bid_id;

    -- G. Send Notification
    DECLARE
        v_recipient_id UUID;
        v_notif_title TEXT;
        v_notif_message TEXT;
    BEGIN
        IF v_user_role = 'WORKER' THEN
            v_recipient_id := v_job.poster_id;
            v_notif_title := 'New Counter Offer';
            v_notif_message := 'Worker sent a counter offer of ₹' || p_amount || ' for ' || v_job.title;
        ELSE
            v_recipient_id := v_bid.worker_id;
            v_notif_title := 'New Counter Offer';
            v_notif_message := 'Employer sent a counter offer of ₹' || p_amount || ' for ' || v_job.title;
        END IF;

        INSERT INTO notifications (user_id, title, message, type, link, created_at)
        VALUES (v_recipient_id, v_notif_title, v_notif_message, 'OFFER', '/job/' || v_job.id, now());
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 2. ACTION: REJECT BID
-- Called by Poster to explicitly reject a bid
CREATE OR REPLACE FUNCTION action_reject_bid(
    p_bid_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
BEGIN
    -- A. Verify Bid & Job
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bid not found');
    END IF;

    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    
    -- B. Authorize (Must be Poster)
    IF auth.uid() != v_job.poster_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only poster can reject');
    END IF;

    -- C. Update Status
    UPDATE bids
    SET status = 'REJECTED', updated_at = now()
    WHERE id = p_bid_id;

    -- D. Send Notification to Worker
    INSERT INTO notifications (user_id, title, message, type, link, created_at)
    VALUES (
        v_bid.worker_id, 
        'Bid Update', 
        'The employer chose a different worker for "' || v_job.title || '". Don''t give up - more jobs await!', 
        'INFO', 
        '/job/' || v_job.id, 
        now()
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
