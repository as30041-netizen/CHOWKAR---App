-- FIX: Populating 'worker_name', 'worker_phone', 'worker_rating', and 'worker_location' in bids table.
-- The production database has denormalized columns on 'bids' that were causing NOT NULL constraints.
-- UPDATE: Added worker_location handling.

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
    -- Denormalized variables
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_rating NUMERIC;
    v_worker_location TEXT; -- New variable
    
    v_current_balance INTEGER;
    v_bid_cost INTEGER := 1;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    
    SELECT status, poster_id, title INTO v_job_status, v_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    -- Check Double Bid
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid on this job');
    END IF;

    -- Fetch Worker Details (Denormalization)
    SELECT 
        name, 
        phone, 
        rating,
        location  -- Fetch location
    INTO 
        v_worker_name, 
        v_worker_phone, 
        v_worker_rating,
        v_worker_location 
    FROM profiles 
    WHERE id = v_worker_id;
    
    -- Fallback/Validation
    IF v_worker_name IS NULL THEN v_worker_name := 'Worker'; END IF;
    IF v_worker_phone IS NULL THEN v_worker_phone := ''; END IF;
    IF v_worker_rating IS NULL THEN v_worker_rating := 0; END IF;
    IF v_worker_location IS NULL THEN v_worker_location := ''; END IF; -- Ensure not null

    -- Check Wallet Balance (Atomic Lock)
    SELECT balance INTO v_current_balance 
    FROM wallets 
    WHERE user_id = v_worker_id 
    FOR UPDATE;
    
    -- Handle missing wallet
    IF v_current_balance IS NULL THEN
        INSERT INTO wallets (user_id, balance) VALUES (v_worker_id, 0)
        RETURNING balance INTO v_current_balance;
    END IF;
    
    IF v_current_balance < v_bid_cost THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient coins. Please top up your wallet.');
    END IF;

    -- Deduct Coin
    UPDATE wallets 
    SET balance = balance - v_bid_cost,
        updated_at = NOW()
    WHERE user_id = v_worker_id;
    
    -- Record Transaction
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, type, description)
    VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'BID_FEE', 'Bid on Job: ' || v_job_title);

    -- Insert Bid (Added worker_location)
    INSERT INTO bids (
        job_id, worker_id, amount, message, status, 
        worker_name, worker_phone, worker_rating, worker_location
    )
    VALUES (
        p_job_id, v_worker_id, p_amount, p_message, 'PENDING', 
        v_worker_name, v_worker_phone, v_worker_rating, v_worker_location
    )
    RETURNING id INTO v_new_bid_id;

    -- Notify Poster
    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (
        v_poster_id, 
        'New Bid Received', 
        'Someone bid ₹' || p_amount || ' on ' || v_job_title, 
        'INFO', 
        p_job_id, 
        NOW()
    );

    RETURN json_build_object(
        'success', true, 
        'bid_id', v_new_bid_id, 
        'coins_remaining', v_current_balance - v_bid_cost
    );
END;
$$;
