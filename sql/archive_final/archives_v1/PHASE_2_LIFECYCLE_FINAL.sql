-- Phase 2: Lifecycle Actions (Final Part)
-- Handles Job Cancellation (with Refunds) and User Blocking

-- 1. Create BLOCKED_USERS table
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS for Blocks
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view who they blocked"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY "Users can block people"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can unblock"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());


-- 2. JOB CANCELLATION & REFUND LOGIC
CREATE OR REPLACE FUNCTION cancel_job_with_refund(
  p_job_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_bid RECORD;
  v_poster_id UUID;
  v_worker_id UUID;
  v_poster_refund INTEGER; -- Fixed Fee (e.g. 19)
  v_worker_refund INTEGER; -- Commission (5%)
BEGIN
  -- Get current user
  v_poster_id := auth.uid();

  -- Get Job Details
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job.poster_id != v_poster_id THEN
    RAISE EXCEPTION 'Not authorized to cancel this job';
  END IF;

  IF v_job.status != 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Can only cancel jobs that are IN_PROGRESS';
  END IF;

  -- Get Accepted Bid Details (to know whom to refund)
  SELECT * INTO v_bid FROM bids WHERE id = v_job.accepted_bid_id;
  
  IF v_bid IS NULL THEN
     -- Weird state, but just cancel the job
     UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;
     RETURN jsonb_build_object('status', 'cancelled_no_refund');
  END IF;

  v_worker_id := v_bid.worker_id;

  -- Calculate Refunds based on transactions
  -- We look for the DEBIT transactions for this job/user to know exactly what to refund
  -- Ideally we store transaction reference, but for now we re-calculate or assume standard fees.
  -- Based on accept_bid logic: Poster pays Fee (e.g. 50), Worker pays 5%.
  
  -- Hardcoded for now based on 'accept_bid' logic logic assuming standard fees were applied.
  -- Better approach: Find the transaction amount.
  
  -- Refund Poster
  SELECT amount INTO v_poster_refund FROM transactions 
  WHERE user_id = v_poster_id AND type = 'DEBIT' AND description = 'Booking Fee' 
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_poster_refund IS NULL THEN v_poster_refund := 0; END IF;

  -- Refund Worker
  SELECT amount INTO v_worker_refund FROM transactions 
  WHERE user_id = v_worker_id AND type = 'DEBIT' AND description LIKE 'Success Fee%' 
  ORDER BY created_at DESC LIMIT 1;

  IF v_worker_refund IS NULL THEN v_worker_refund := 0; END IF;

  -- PERFORM REFUNDS
  
  -- 1. Refund Poster
  IF v_poster_refund > 0 THEN
      UPDATE profiles SET wallet_balance = wallet_balance + v_poster_refund WHERE id = v_poster_id;
      INSERT INTO transactions (user_id, amount, type, description)
      VALUES (v_poster_id, v_poster_refund, 'CREDIT', 'Refund: Job Cancelled');
  END IF;

  -- 2. Refund Worker
  IF v_worker_refund > 0 THEN
      UPDATE profiles SET wallet_balance = wallet_balance + v_worker_refund WHERE id = v_worker_id;
      INSERT INTO transactions (user_id, amount, type, description)
      VALUES (v_worker_id, v_worker_refund, 'CREDIT', 'Refund: Job Cancelled by Poster');
  END IF;

  -- 3. Update Job
  UPDATE jobs SET status = 'CANCELLED' WHERE id = p_job_id;

  -- 4. Notify Worker
  INSERT INTO notifications (user_id, title, message, type, related_job_id)
  VALUES (v_worker_id, 'Job Cancelled', 'The poster has cancelled the job. Your fees have been refunded.', 'WARNING', p_job_id);

  RETURN jsonb_build_object(
    'success', true, 
    'refunded_poster', v_poster_refund,
    'refunded_worker', v_worker_refund
  );
END;
$$;
