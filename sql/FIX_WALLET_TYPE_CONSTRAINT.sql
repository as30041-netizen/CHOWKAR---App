-- FIX: Populate 'type' column in wallet_transactions to satisfy NOT NULL constraint
-- The 'action_place_bid', 'process_transaction', and 'admin_activate_premium' functions were failing because they left 'type' null.

-- 1. FIX action_place_bid
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
    
    -- Record Transaction (Fixed: Populating 'type' as well)
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, type, description)
    VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'BID_FEE', 'Bid on Job: ' || v_job_title);

    -- Insert Bid
    INSERT INTO bids (job_id, worker_id, amount, message, status)
    VALUES (p_job_id, v_worker_id, p_amount, p_message, 'PENDING')
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

-- 2. FIX process_transaction
CREATE OR REPLACE FUNCTION process_transaction(
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_balance INTEGER;
  v_txn_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  UPDATE wallets
  SET balance = balance + (CASE WHEN p_type = 'CREDIT' THEN p_amount ELSE -p_amount END),
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;
  
  IF v_new_balance < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  
  -- Fixed: Populating 'type' as well
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, type, description)
  VALUES (v_user_id, p_amount, p_type, p_type, p_description)
  RETURNING id INTO v_txn_id;
  
  RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'txn_id', v_txn_id);
END;
$$;

-- 3. FIX admin_activate_premium
CREATE OR REPLACE FUNCTION admin_activate_premium(
    p_event_id TEXT,
    p_user_id UUID,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Idempotent skip');
    END IF;

    UPDATE profiles SET is_premium = true, updated_at = NOW() WHERE id = p_user_id;

    -- Fixed: Populating 'type' as well
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, type, description)
    VALUES (p_user_id, 0, 'PURCHASE', 'PURCHASE', 'Premium Upgrade');

    INSERT INTO processed_webhooks (id, payload) VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true);
END;
$$;
