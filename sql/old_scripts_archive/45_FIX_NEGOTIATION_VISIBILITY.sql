-- ============================================================================
-- SQL: FIX NEGOTIATION VISIBILITY (Phase 45)
-- Purpose: Ensure 'negotiation_history' is properly tracked so the Frontend
--          knows when to show the "Counter Offer" badge.
-- ============================================================================

BEGIN;

-- 1. UPDATE ACTION_PLACE_BID (Initialize History)
CREATE OR REPLACE FUNCTION action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_status TEXT;
    v_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_rating NUMERIC;
    v_worker_location TEXT;
    v_current_balance INTEGER;
    v_bid_cost INTEGER := 1;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    
    SELECT status, poster_id, title INTO v_job_status, v_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid on this job');
    END IF;

    -- Fetch Worker Details
    SELECT name, phone, rating, location INTO v_worker_name, v_worker_phone, v_worker_rating, v_worker_location FROM profiles WHERE id = v_worker_id;
    
    -- Check Balance
    SELECT balance INTO v_current_balance FROM wallets WHERE user_id = v_worker_id FOR UPDATE;
    IF v_current_balance IS NULL THEN
        INSERT INTO wallets (user_id, balance) VALUES (v_worker_id, 0) RETURNING balance INTO v_current_balance;
    END IF;
    
    IF v_current_balance < v_bid_cost THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- Deduct Coin
    UPDATE wallets SET balance = balance - v_bid_cost, updated_at = NOW() WHERE user_id = v_worker_id;
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, type, description)
    VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'BID_FEE', 'Bid on Job: ' || v_job_title);

    -- Insert Bid with INITIAL HISTORY
    INSERT INTO bids (
        job_id, worker_id, amount, message, status, 
        worker_name, worker_phone, worker_rating, worker_location,
        negotiation_history -- Initialize history with first bid
    )
    VALUES (
        p_job_id, v_worker_id, p_amount, p_message, 'PENDING', 
        v_worker_name, v_worker_phone, v_worker_rating, v_worker_location,
        jsonb_build_array(jsonb_build_object('amount', p_amount, 'by', 'WORKER', 'at', extract(epoch from now()) * 1000, 'message', p_message))
    )
    RETURNING id INTO v_new_bid_id;

    -- Notify Poster
    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (v_poster_id, 'New Bid Received', 'Someone bid ₹' || p_amount || ' on ' || v_job_title, 'INFO', p_job_id, NOW());

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id, 'coins_remaining', v_current_balance - v_bid_cost);
END;
$$;


-- 2. UPDATE ACTION_COUNTER_BID (Robust Append)
CREATE OR REPLACE FUNCTION action_counter_bid(
    p_bid_id UUID,
    p_amount NUMERIC,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
    v_user_role TEXT;
    v_negotiation_entry JSONB;
BEGIN
    IF p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;

    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;

    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    IF v_job.status != 'OPEN' THEN RETURN jsonb_build_object('success', false, 'error', 'Job no longer open'); END IF;

    IF auth.uid() = v_bid.worker_id THEN v_user_role := 'WORKER';
    ELSIF auth.uid() = v_job.poster_id THEN v_user_role := 'POSTER';
    ELSE RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_negotiation_entry := jsonb_build_object('by', v_user_role, 'amount', p_amount, 'message', p_message, 'at', extract(epoch from now()) * 1000);

    UPDATE bids
    SET 
        amount = p_amount, 
        message = p_message, 
        -- If history is null, start with empty array, then append
        negotiation_history = COALESCE(negotiation_history, '[]'::jsonb) || v_negotiation_entry, 
        status = 'PENDING', 
        updated_at = now()
    WHERE id = p_bid_id;

    -- Notify
    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (
        CASE WHEN v_user_role = 'WORKER' THEN v_job.poster_id ELSE v_bid.worker_id END, 
        'New Counter Offer', 
        CASE WHEN v_user_role = 'WORKER' THEN 'Worker' ELSE 'Employer' END || ' sent a counter offer of ₹' || p_amount || ' for ' || v_job.title, 
        'INFO',
        v_job.id,
        now()
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;

-- 3. Data Repair: Ensure existing bids have history if pending
-- (Optional but helpful for testing)
UPDATE bids 
SET negotiation_history = jsonb_build_array(jsonb_build_object('amount', amount, 'by', 'WORKER', 'at', extract(epoch from created_at) * 1000))
WHERE negotiation_history IS NULL;

-- End of Script
