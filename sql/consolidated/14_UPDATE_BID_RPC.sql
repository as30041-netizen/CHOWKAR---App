-- ============================================================================
-- UPDATE BID RPC (CORRECTED)
-- Enforce Coin Deduction (1 Coin per Bid) using WALLETS table
-- ============================================================================

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
    v_current_balance INTEGER;
    v_bid_cost INTEGER := 1;
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    
    SELECT status, poster_id INTO v_job_status, v_poster_id FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    -- Check Double Bid
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid on this job');
    END IF;

    -- Check Wallet Balance (Atomic Lock)
    SELECT balance INTO v_current_balance 
    FROM wallets 
    WHERE user_id = v_worker_id 
    FOR UPDATE;
    
    -- Handle missing wallet (auto-create if not exists, though auth should handle this)
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
    INSERT INTO wallet_transactions (wallet_id, amount, type, description)
    VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'Bid on Job ' || p_job_id);

    -- Insert Bid
    INSERT INTO bids (job_id, worker_id, amount, message, status)
    VALUES (p_job_id, v_worker_id, p_amount, p_message, 'PENDING')
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object(
        'success', true, 
        'bid_id', v_new_bid_id, 
        'coins_remaining', v_current_balance - v_bid_cost
    );
END;
$$;
