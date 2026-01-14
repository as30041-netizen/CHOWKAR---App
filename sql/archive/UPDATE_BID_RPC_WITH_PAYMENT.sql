-- ============================================================================
-- 🪙 UPDATE BID RPC WITH PAYMENT
-- Deducts 1 Coin for every bid placed
-- ============================================================================

BEGIN;

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
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    -- Worker Metadata
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_photo TEXT;
    v_worker_location TEXT;
    v_worker_rating NUMERIC;
    v_worker_lat DOUBLE PRECISION;
    v_worker_lng DOUBLE PRECISION;
    -- Wallet
    v_balance INTEGER;
    c_bid_cost CONSTANT INTEGER := 1;
BEGIN
    -- 1. Check Job Status
    SELECT status, poster_id INTO v_job_status, v_poster_id FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job closed'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    -- 2. Check Existing Bid
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid');
    END IF;

    -- 3. CHECK WALLET BALANCE (New Logic)
    SELECT balance INTO v_balance FROM wallets WHERE user_id = v_worker_id;
    
    -- Handle missing wallet (shouldn't happen due to trigger, but safe fallback)
    IF v_balance IS NULL THEN
        INSERT INTO wallets (user_id, balance) VALUES (v_worker_id, 0);
        v_balance := 0;
    END IF;

    IF v_balance < c_bid_cost THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient coins', 'code', 'LOW_BALANCE');
    END IF;

    -- 4. DEDUCT COINS
    UPDATE wallets SET balance = balance - c_bid_cost WHERE user_id = v_worker_id;
    
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (v_worker_id, -c_bid_cost, 'BID_FEE', 'Bid Fee for Job', p_job_id);

    -- 5. Denormalize worker profile
    SELECT name, phone, profile_photo, location, rating, latitude, longitude 
    INTO v_worker_name, v_worker_phone, v_worker_photo, v_worker_location, v_worker_rating, v_worker_lat, v_worker_lng
    FROM profiles WHERE id = v_worker_id;

    -- 6. Insert Bid
    INSERT INTO bids (
        job_id, worker_id, poster_id, amount, message, status, 
        worker_name, worker_phone, worker_photo, worker_location, 
        worker_rating, worker_latitude, worker_longitude
    )
    VALUES (
        p_job_id, v_worker_id, v_poster_id, p_amount, p_message, 'PENDING',
        COALESCE(v_worker_name, 'Worker'), v_worker_phone, v_worker_photo, v_worker_location,
        COALESCE(v_worker_rating, 0), v_worker_lat, v_worker_lng
    )
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id, 'balance', v_balance - c_bid_cost);
END;
$$;

COMMIT;
