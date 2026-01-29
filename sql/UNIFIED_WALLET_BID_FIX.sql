
-- ============================================================================
-- 🪙 UNIFIED WALLET & BIDDING FIX
-- Addressing:
-- 1. Razorpay Double Crediting (Idempotency Fix)
-- 2. Hardcoded Bid Fees (Admin Config Sync)
-- ============================================================================

BEGIN;

-- 1. Ensure processed_webhooks has order_id and unique index
ALTER TABLE public.processed_webhooks 
ADD COLUMN IF NOT EXISTS order_id TEXT;

DROP INDEX IF EXISTS idx_processed_webhooks_order_id;
CREATE UNIQUE INDEX idx_processed_webhooks_order_id 
ON public.processed_webhooks (order_id) 
WHERE order_id IS NOT NULL AND order_id != 'unknown';

-- 2. Update Payment Processor RPC
CREATE OR REPLACE FUNCTION admin_process_payment_webhook(
    p_event_id TEXT,
    p_user_id UUID,
    p_amount INTEGER,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
    v_already_processed BOOLEAN;
BEGIN
    -- A. Idempotency Check by Order ID
    -- If we have an order_id, check if it's already in processed_webhooks
    IF p_order_id IS NOT NULL AND p_order_id != 'unknown' THEN
        SELECT EXISTS (SELECT 1 FROM processed_webhooks WHERE order_id = p_order_id) INTO v_already_processed;
        IF v_already_processed THEN
            RETURN json_build_object('success', true, 'message', 'Order already processed', 'idempotent', true);
        END IF;
    END IF;

    -- B. Secondary Idempotency Check by Event ID (Standard Webhook Safety)
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
    END IF;

    -- C. Register the Webhook/Event immediately (LOCK)
    INSERT INTO processed_webhooks (event_id, payload, order_id)
    VALUES (p_event_id, p_raw_event, p_order_id)
    ON CONFLICT (event_id) DO NOTHING;

    -- D. Verify User exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- E. Credit Wallet
    UPDATE wallets 
    SET balance = balance + p_amount, 
        updated_at = NOW() 
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance) VALUES (p_user_id, p_amount)
        RETURNING balance INTO v_new_balance;
    END IF;

    -- F. Transaction Log
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE', 
        'Coin Purchase (Order: ' || COALESCE(p_order_id, 'Direct') || ')', 
        NULL
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Update Bidding RPC to use Dynamic Config
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
    v_balance INTEGER;
    v_bid_fee INTEGER;
    -- Worker Metadata
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_photo TEXT;
    v_worker_location TEXT;
    v_worker_rating NUMERIC;
    v_worker_lat DOUBLE PRECISION;
    v_worker_lng DOUBLE PRECISION;
BEGIN
    -- 1. Get Bid Fee from Admin Settings
    SELECT value::integer INTO v_bid_fee 
    FROM global_settings 
    WHERE key = 'bid_fee';
    
    v_bid_fee := COALESCE(v_bid_fee, 1); -- Fallback to 1 if not set

    -- 2. Validation: Job Exists & Open
    SELECT status, poster_id INTO v_job_status, v_poster_id FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is no longer open for bidding'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'You cannot bid on your own job'); END IF;

    -- 3. Validation: Duplicate Bid
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'You have already placed a bid on this job');
    END IF;

    -- 4. Check Wallet Balance
    SELECT balance INTO v_balance FROM wallets WHERE user_id = v_worker_id;
    v_balance := COALESCE(v_balance, 0);

    IF v_balance < v_bid_fee THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient coins. Please top up your wallet.', 'code', 'LOW_BALANCE', 'required', v_bid_fee);
    END IF;

    -- 5. Deduct Coins
    UPDATE wallets SET balance = balance - v_bid_fee WHERE user_id = v_worker_id;
    
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (v_worker_id, -v_bid_fee, 'BID_FEE', 'Bid Fee for Job', p_job_id);

    -- 6. Fetch Worker Profile details
    SELECT name, phone, profile_photo, location, rating, latitude, longitude 
    INTO v_worker_name, v_worker_phone, v_worker_photo, v_worker_location, v_worker_rating, v_worker_lat, v_worker_lng
    FROM profiles WHERE id = v_worker_id;

    -- 7. Insert Bid
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

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id, 'new_balance', v_balance - v_bid_fee);
END;
$$;

COMMIT;
