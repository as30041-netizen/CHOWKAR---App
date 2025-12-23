-- ========================================================
-- URGENT HOTFIX: Notification Column & Bid Integrity
-- ========================================================

-- Start transaction
BEGIN;

-- 1. FIX: Missing column for mark_messages_read
-- This column is required by the RPC function to track read status updates
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. FIX: Accepted Bid Integrity
-- Ensure that if a bid is deleted (e.g. withdrawn or removed by poster), 
-- the job's accepted_bid_id reference is cleared automatically.
-- First, find the constraint name
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT conname INTO v_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'jobs'::regclass 
      AND confrelid = 'bids'::regclass;
    
    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE jobs DROP CONSTRAINT ' || v_constraint_name;
    END IF;
END $$;

ALTER TABLE jobs 
  ADD CONSTRAINT jobs_accepted_bid_id_fkey 
  FOREIGN KEY (accepted_bid_id) 
  REFERENCES bids(id) 
  ON DELETE SET NULL;

-- 3. FIX: mark_messages_read RPC
-- Make it more resilient to missing values
CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark Chat Messages as Read
  UPDATE chat_messages 
  SET read = TRUE, 
      read_at = NOW()
  WHERE job_id = p_job_id 
    AND receiver_id = p_user_id 
    AND (read = FALSE OR read IS NULL);

  -- Mark Related Notifications as Read
  UPDATE notifications
  SET read = TRUE, 
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND related_job_id = p_job_id
    AND (read = FALSE OR read IS NULL);
END;
$$;

-- 4. FIX: accept_bid RPC
-- Ensure it can handle bids that might have different statuses or missing fees
CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id uuid,
  p_bid_id uuid,
  p_poster_id uuid,
  p_worker_id uuid,
  p_amount integer,
  p_poster_fee integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_status text;
  v_bid_status text;
  v_worker_commission integer;
BEGIN
  -- 1. Validate Job
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job_status IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  
  -- Allow accepting even if status is not 'OPEN' but this is the accepted bid (idempotency)
  IF v_job_status != 'OPEN' THEN
    IF EXISTS(SELECT 1 FROM jobs WHERE id = p_job_id AND accepted_bid_id = p_bid_id) THEN
        RETURN;
    END IF;
    RAISE EXCEPTION 'Job is no longer OPEN (Status: %)', v_job_status;
  END IF;

  -- 2. Validate Bid
  SELECT status INTO v_bid_status FROM bids WHERE id = p_bid_id FOR UPDATE;
  IF v_bid_status IS NULL THEN RAISE EXCEPTION 'Bid not found'; END IF;
  IF v_bid_status != 'PENDING' THEN
    RAISE EXCEPTION 'Bid is already %', v_bid_status;
  END IF;

  -- 3. Calculate Worker Commission (5%)
  v_worker_commission := CEIL(p_amount * 0.05);

  -- 4. Execute Financial Updates (Idempotent check)
  -- Only deduct if not zero
  IF p_poster_fee > 0 THEN
    UPDATE profiles SET wallet_balance = wallet_balance - p_poster_fee WHERE id = p_poster_id;
  END IF;
  
  -- Note: We generally don't deduct commission until job completion in many models, 
  -- but we'll stick to the current logic unless told otherwise.
  -- UPDATE profiles SET wallet_balance = wallet_balance - v_worker_commission WHERE id = p_worker_id;

  -- 5. Update Job Status
  UPDATE jobs 
  SET status = 'IN_PROGRESS', 
      accepted_bid_id = p_bid_id 
  WHERE id = p_job_id;

  -- 6. Update Bids Status (Accept One, Reject Others)
  UPDATE bids SET status = 'ACCEPTED' WHERE id = p_bid_id;
  UPDATE bids SET status = 'REJECTED' WHERE job_id = p_job_id AND id != p_bid_id AND status = 'PENDING';

  -- 7. Insert Transaction Records
  IF p_poster_fee > 0 THEN
    INSERT INTO transactions (user_id, amount, type, description, related_job_id)
    VALUES (p_poster_id, p_poster_fee, 'DEBIT', 'Booking Fee', p_job_id);
  END IF;

  -- Optional: Notify winner is handled by DB triggers
END;
$$;

COMMIT;
