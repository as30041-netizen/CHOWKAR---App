-- Drop existing function to ensure fresh start
DROP FUNCTION IF EXISTS accept_bid(uuid, uuid, uuid, uuid, integer, integer);

-- Create the function with robust error handling and type checking
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
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_job_status text;
  v_bid_exists boolean;
  v_worker_commission integer;
BEGIN
  -- 0. Validate Job Status
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id;
  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is no longer OPEN (Status: %)', v_job_status;
  END IF;

  -- 1. Validate Bid Exists
  SELECT EXISTS(SELECT 1 FROM bids WHERE id = p_bid_id AND status = 'PENDING') INTO v_bid_exists;
  IF NOT v_bid_exists THEN
    RAISE EXCEPTION 'Bid not found or not PENDING';
  END IF;

  -- 2. Check Poster Balance
  SELECT wallet_balance INTO v_balance FROM profiles WHERE id = p_poster_id;
  
  IF v_balance IS NULL THEN
     v_balance := 0;
  END IF;

  IF v_balance < p_poster_fee THEN
    RAISE EXCEPTION 'Insufficient Balance (Poster). Available: %, Required: %', v_balance, p_poster_fee;
  END IF;

  -- 3. Calculate Worker Commission (5%)
  v_worker_commission := CEIL(p_amount * 0.05);

  -- 4. Execute Financial Updates
  -- Deduct from Poster
  UPDATE profiles 
  SET wallet_balance = wallet_balance - p_poster_fee 
  WHERE id = p_poster_id;

  -- Deduct from Worker (Allowing negative balance for now to not block the deal)
  UPDATE profiles
  SET wallet_balance = wallet_balance - v_worker_commission
  WHERE id = p_worker_id;

  -- 5. Update Job Status
  UPDATE jobs 
  SET status = 'IN_PROGRESS', 
      accepted_bid_id = p_bid_id 
  WHERE id = p_job_id;

  -- 6. Update Bids Status (Accept One, Reject Others)
  UPDATE bids SET status = 'ACCEPTED' WHERE id = p_bid_id;
  UPDATE bids SET status = 'REJECTED' WHERE job_id = p_job_id AND id != p_bid_id;

  -- 7. Insert Transaction Records
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (p_poster_id, p_poster_fee, 'DEBIT', 'Booking Fee');

  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (p_worker_id, v_worker_commission, 'DEBIT', 'Success Fee (5%)');

END;
$$;
