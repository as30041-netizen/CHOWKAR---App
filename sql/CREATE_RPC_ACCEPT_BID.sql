-- ATOMIC ACCEPT BID FUNCTION (ROBUST VERSION)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id uuid,
  p_bid_id uuid,
  p_poster_id uuid,
  p_worker_id uuid,
  p_amount integer,
  p_poster_fee integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
  v_job_status text;
BEGIN
  -- 0. Validate Job Status (Prevent Double Booking)
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id;
  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is no longer OPEN (Status: %)', v_job_status;
  END IF;

  -- 1. Validate Bid Exists (Prevent Race Condition with Withdraw)
  PERFORM 1 FROM bids WHERE id = p_bid_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found. The worker might have withdrawn it.';
  END IF;

  -- 2. Check Balance
  SELECT wallet_balance INTO v_balance FROM profiles WHERE id = p_poster_id;
  IF v_balance < p_poster_fee THEN
    RAISE EXCEPTION 'Insufficient Balance. Required: %', p_poster_fee;
  END IF;

  -- 3. Deduct Balance from Poster
  UPDATE profiles 
  SET wallet_balance = wallet_balance - p_poster_fee 
  WHERE id = p_poster_id;

  -- 4. Update Job Status
  UPDATE jobs 
  SET status = 'IN_PROGRESS', 
      accepted_bid_id = p_bid_id 
  WHERE id = p_job_id;

  -- 5. Update Bids Status (Accept One, Reject Others)
  UPDATE bids SET status = 'ACCEPTED' WHERE id = p_bid_id;
  UPDATE bids SET status = 'REJECTED' WHERE job_id = p_job_id AND id != p_bid_id;

  -- 6. Insert Transaction Records
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (p_poster_id, p_poster_fee, 'DEBIT', 'Booking Fee');

  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (p_worker_id, CEIL(p_amount * 0.05), 'DEBIT', 'Success Fee');

END;
$$;
