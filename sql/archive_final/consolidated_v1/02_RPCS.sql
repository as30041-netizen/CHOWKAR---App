-- ============================================================================
-- CHOWKAR MASTER RPCs
-- Consolidated Database Functions
-- ============================================================================

BEGIN;

-- 1. BIDDING SYSTEM RPCs
-- ============================================================================

-- A. Place Bid (Atomic)
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
BEGIN
    -- Validation
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    
    SELECT status, poster_id INTO v_job_status, v_poster_id FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    IF EXISTS (SELECT 1 FROM bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid on this job');
    END IF;

    -- Insert
    INSERT INTO bids (job_id, worker_id, amount, message, status)
    VALUES (p_job_id, v_worker_id, p_amount, p_message, 'PENDING')
    RETURNING id INTO v_new_bid_id;

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

-- B. Accept Bid (Atomic)
CREATE OR REPLACE FUNCTION action_accept_bid(
    p_bid_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
    v_poster_id UUID;
    v_job_status TEXT;
BEGIN
    SELECT job_id, status INTO v_job_id, v_job_status FROM bids WHERE id = p_bid_id;
    SELECT poster_id INTO v_poster_id FROM jobs WHERE id = v_job_id;
    
    IF v_poster_id != auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
    
    -- Update Bid
    UPDATE bids SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = p_bid_id;
    
    -- Update Job
    UPDATE jobs SET status = 'IN_PROGRESS', accepted_bid_id = p_bid_id WHERE id = v_job_id;
    
    -- Reject others
    UPDATE bids SET status = 'REJECTED' WHERE job_id = v_job_id AND id != p_bid_id AND status = 'PENDING';
    
    RETURN json_build_object('success', true);
END;
$$;

-- C. Withdraw Bid
CREATE OR REPLACE FUNCTION withdraw_from_job(
  p_job_id UUID,
  p_bid_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM bids WHERE id = p_bid_id AND worker_id = auth.uid() AND status = 'PENDING';
  IF FOUND THEN
      RETURN json_build_object('success', true);
  ELSE
      RETURN json_build_object('success', false, 'error', 'Bid not found or not pending');
  END IF;
END;
$$;


-- 2. JOB MANAGEMENT RPCs
-- ============================================================================

-- A. Hide Job (Soft Delete for User)
CREATE TABLE IF NOT EXISTS user_job_visibility (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT FALSE,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

CREATE OR REPLACE FUNCTION hide_job_for_user(p_job_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_job_visibility (user_id, job_id, is_hidden)
  VALUES (auth.uid(), p_job_id, TRUE)
  ON CONFLICT (user_id, job_id) DO UPDATE SET is_hidden = TRUE, hidden_at = NOW();
END;
$$;

-- B. Cancel Job with Refund
CREATE OR REPLACE FUNCTION cancel_job_with_refund(p_job_id UUID, p_reason TEXT DEFAULT 'Cancelled')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker_id UUID;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id AND poster_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF v_job.accepted_bid_id IS NOT NULL THEN
    SELECT worker_id INTO v_worker_id FROM bids WHERE id = v_job.accepted_bid_id;
  END IF;

  UPDATE jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = p_job_id;

  IF v_worker_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, related_job_id)
    VALUES (v_worker_id, 'WARNING', 'Job Cancelled', 'Employer cancelled "' || v_job.title || '".', p_job_id);
    UPDATE bids SET status = 'REJECTED' WHERE id = v_job.accepted_bid_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 3. WALLET RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION process_transaction(
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_balance INTEGER;
BEGIN
  IF p_type = 'CREDIT' THEN
    UPDATE wallets SET balance = balance + p_amount WHERE user_id = v_user_id RETURNING balance INTO v_new_balance;
  ELSIF p_type = 'DEBIT' THEN
    UPDATE wallets SET balance = balance - p_amount WHERE user_id = v_user_id RETURNING balance INTO v_new_balance;
  END IF;
  
  INSERT INTO wallet_transactions (wallet_id, amount, type, description)
  VALUES (v_user_id, p_amount, p_type, p_description);
  
  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

COMMIT;
