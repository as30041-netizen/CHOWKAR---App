-- ============================================================================
-- CLEANUP_MIGRATION.sql
-- Purpose: Transition to Hybrid Freemium (No Commission) Model
-- 1. Remove Bid Fees (Make Bidding Free)
-- 2. Remove Booking Fees (Make Hiring Free)
-- 3. Remove Commission Logic (Drop charge_commission)
-- ============================================================================

BEGIN;

-- 1. DROP OBSOLETE FUNCTIONS
-- We no longer charge commissions, so this logic is dangerous to keep.
DROP FUNCTION IF EXISTS charge_commission(UUID, UUID, INTEGER);

-- 2. UPDATE 'action_place_bid' (Make it FREE)
-- Redefined to remove wallet deduction and transaction logging for fees.
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
    v_worker_location TEXT;
    
    -- Removed 'v_current_balance' check for fee
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
        name, phone, rating, location 
    INTO 
        v_worker_name, v_worker_phone, v_worker_rating, v_worker_location 
    FROM profiles WHERE id = v_worker_id;
    
    -- Fallback/Validation
    IF v_worker_name IS NULL THEN v_worker_name := 'Worker'; END IF;
    IF v_worker_phone IS NULL THEN v_worker_phone := ''; END IF;
    IF v_worker_rating IS NULL THEN v_worker_rating := 0; END IF;
    IF v_worker_location IS NULL THEN v_worker_location := ''; END IF;

    -- [REMOVED] Wallet Balance Deduction Logic
    -- [REMOVED] Wallet Transaction Log

    -- Insert Bid
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
    VALUES (v_poster_id, 'New Bid Received', 'Someone bid ₹' || p_amount || ' on ' || v_job_title, 'INFO', p_job_id, NOW());

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id, 'message', 'Bid placed successfully (Free)');
END;
$$;


-- 3. UPDATE 'accept_bid' (Make it FREE)
-- Remove 'p_poster_fee' parameter/usage.
CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id UUID,
  p_bid_id UUID,
  p_poster_id UUID,
  p_worker_id UUID,
  p_amount INTEGER
  -- Removed p_poster_fee
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_status TEXT;
  v_bid_status TEXT;
  v_bid_exists BOOLEAN;
BEGIN
  -- 1. LOCK the job row to prevent race conditions
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id FOR UPDATE;
  
  IF v_job_status IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job_status != 'OPEN' THEN RAISE EXCEPTION 'Job is not open (Status: %)', v_job_status; END IF;

  -- 2. Verify Bid Status
  SELECT status, TRUE INTO v_bid_status, v_bid_exists FROM bids WHERE id = p_bid_id;
  
  IF v_bid_exists IS NULL THEN RAISE EXCEPTION 'Bid not found'; END IF;
  IF v_bid_status = 'REJECTED' THEN RAISE EXCEPTION 'Cannot accept a withdrawn/rejected bid.'; END IF;

  -- [REMOVED] Financial Deduction Logic

  -- 3. Update job status to IN_PROGRESS
  UPDATE jobs
  SET 
    status = 'IN_PROGRESS',
    accepted_bid_id = p_bid_id,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- 4. Update accepted bid status AND accepted_at timestamp
  UPDATE bids
  SET 
    status = 'ACCEPTED',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_bid_id;

  -- 5. Reject all other PENDING bids
  UPDATE bids
  SET 
    status = 'REJECTED',
    updated_at = NOW()
  WHERE job_id = p_job_id 
    AND id != p_bid_id 
    AND status = 'PENDING';
    
    -- Notify Worker
  INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
  VALUES (p_worker_id, '🎉 You Got the Job!', 'The employer accepted your bid! Check your Active Jobs feed.', 'SUCCESS', p_job_id, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bid accepted successfully'
  );
END;
$$;

COMMIT;
