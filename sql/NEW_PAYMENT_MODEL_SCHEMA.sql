-- NEW PAYMENT MODEL SCHEMA
-- Run this in Supabase SQL Editor

-- 1. Admin Configuration Table
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default pricing (admin can change later)
INSERT INTO app_config (key, value, description) VALUES
  ('job_posting_fee', '10', 'Fee in INR for posting a job'),
  ('connection_fee', '20', 'Fee in INR for worker to unlock chat')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Add payment columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
-- Values: 'PENDING', 'PAID'

-- 3. Add payment columns to bids table
ALTER TABLE bids ADD COLUMN IF NOT EXISTS connection_payment_id TEXT;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS connection_payment_status TEXT DEFAULT 'NOT_REQUIRED';
-- Values: 'NOT_REQUIRED', 'PENDING', 'PAID'

-- 4. Payments tracking table (for all payments)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_type TEXT NOT NULL, -- 'JOB_POSTING' or 'CONNECTION'
  related_job_id UUID,
  related_bid_id UUID,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. RLS for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  USING (user_id = auth.uid());

-- 6. RLS for app_config (read-only for all)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read config"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

-- 7. Update accept_bid function (remove fee charging)
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
  v_job_status text;
  v_bid_exists boolean;
BEGIN
  -- Validate Job Status
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id;
  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is no longer OPEN (Status: %)', v_job_status;
  END IF;

  -- Validate Bid Exists
  SELECT EXISTS(SELECT 1 FROM bids WHERE id = p_bid_id AND status = 'PENDING') INTO v_bid_exists;
  IF NOT v_bid_exists THEN
    RAISE EXCEPTION 'Bid not found or not PENDING';
  END IF;

  -- NO FEE CHARGING - fees removed
  -- The poster already paid when posting the job
  -- The worker will pay when they click "unlock chat"

  -- Update Job Status
  UPDATE jobs 
  SET status = 'IN_PROGRESS', 
      accepted_bid_id = p_bid_id 
  WHERE id = p_job_id;

  -- Update Bids Status (Accept One, Reject Others)
  -- Set connection_payment_status to PENDING for the accepted worker
  UPDATE bids 
  SET status = 'ACCEPTED', 
      connection_payment_status = 'PENDING' 
  WHERE id = p_bid_id;
  
  UPDATE bids SET status = 'REJECTED' WHERE job_id = p_job_id AND id != p_bid_id;

  -- NO TRANSACTION RECORDS - will be created when actual payments happen

END;
$$;

-- 8. Remove wallet_balance column (optional - we'll handle this in code)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS wallet_balance;
-- Keeping for now as we'll remove it gradually

COMMENT ON TABLE app_config IS 'Admin-configurable settings for the app';
COMMENT ON TABLE payments IS 'All Razorpay payments tracking';
