-- ========================================================
-- REMOVE WALLET AND PAYMENT SYSTEM
-- ========================================================
-- This script removes all wallet, payment, and referral functionality
-- WARNING: This will delete all user wallet balances and transaction history
-- ========================================================

BEGIN;

-- ========================================================
-- STEP 1: DROP PAYMENT-RELATED RPC FUNCTIONS
-- ========================================================

DROP FUNCTION IF EXISTS process_transaction(INTEGER, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS check_wallet_balance(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_from_wallet(UUID, INTEGER, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS add_to_wallet(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_transaction_history(UUID);
DROP FUNCTION IF EXISTS trigger_referral_reward();

-- ========================================================
-- STEP 2: DROP TRIGGERS
-- ========================================================

DROP TRIGGER IF EXISTS trigger_referral_reward ON profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON profiles;

-- ========================================================
-- STEP 3: DROP TABLES
-- ========================================================

-- Drop transactions table (wallet transaction history)
DROP TABLE IF EXISTS public.transactions CASCADE;

-- Drop payments table (payment gateway records)
DROP TABLE IF EXISTS public.payments CASCADE;

-- Drop app_config table (fee configuration)
DROP TABLE IF EXISTS public.app_config CASCADE;

-- ========================================================
-- STEP 4: REMOVE COLUMNS FROM EXISTING TABLES
-- ========================================================

-- Remove wallet and referral columns from profiles table
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS wallet_balance,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS referred_by,
  DROP COLUMN IF EXISTS has_seen_welcome_bonus;

-- Remove payment columns from jobs table
ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS payment_id,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS posting_fee_paid;

-- Remove payment columns from bids table
ALTER TABLE public.bids
  DROP COLUMN IF EXISTS connection_payment_id,
  DROP COLUMN IF EXISTS connection_payment_status,
  DROP COLUMN IF EXISTS connection_fee_paid;

-- ========================================================
-- STEP 5: UPDATE ACCEPT_BID FUNCTION (REMOVE PAYMENT LOGIC)
-- ========================================================

-- Drop the existing function with its exact signature
DROP FUNCTION IF EXISTS accept_bid(UUID, UUID, UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id UUID,
  p_bid_id UUID,
  p_poster_id UUID,
  p_worker_id UUID,
  p_amount INTEGER,
  p_poster_fee INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_status TEXT;
BEGIN
  -- Get current job status
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id;
  
  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is not open for bidding (current status: %)', v_job_status;
  END IF;

  -- Update job status to IN_PROGRESS
  UPDATE jobs
  SET 
    status = 'IN_PROGRESS',
    accepted_bid_id = p_bid_id,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Update accepted bid status
  UPDATE bids
  SET 
    status = 'ACCEPTED',
    updated_at = NOW()
  WHERE id = p_bid_id;

  -- Reject all other pending bids
  UPDATE bids
  SET 
    status = 'REJECTED',
    updated_at = NOW()
  WHERE job_id = p_job_id 
    AND id != p_bid_id 
    AND status = 'PENDING';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bid accepted successfully'
  );
END;
$$;

-- ========================================================
-- STEP 6: UPDATE OR REMOVE CANCEL_JOB FUNCTION
-- ========================================================

-- Drop the existing function with its exact signature
DROP FUNCTION IF EXISTS cancel_job_with_refund(UUID, TEXT);

CREATE OR REPLACE FUNCTION cancel_job_with_refund(
  p_job_id UUID,
  p_reason TEXT DEFAULT 'Cancelled by poster'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_accepted_bid RECORD;
BEGIN
  -- Get job details
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job.status != 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Only in-progress jobs can be cancelled';
  END IF;

  -- Get accepted bid if exists
  IF v_job.accepted_bid_id IS NOT NULL THEN
    SELECT * INTO v_accepted_bid FROM bids WHERE id = v_job.accepted_bid_id;
  END IF;

  -- Update job status to cancelled
  UPDATE jobs
  SET 
    status = 'COMPLETED', -- Or create a CANCELLED status if needed
    updated_at = NOW()
  WHERE id = p_job_id;

  -- Update accepted bid to rejected
  IF v_accepted_bid IS NOT NULL THEN
    UPDATE bids
    SET 
      status = 'REJECTED',
      updated_at = NOW()
    WHERE id = v_accepted_bid.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Job cancelled successfully',
    'refund_amount', 0,
    'penalty', false
  );
END;
$$;

COMMIT;

-- ========================================================
-- VERIFICATION QUERIES (Run these separately to verify)
-- ========================================================

-- Check if tables are removed
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('transactions', 'payments', 'app_config');

-- Check if columns are removed from profiles
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- AND column_name IN ('wallet_balance', 'referral_code', 'referred_by', 'has_seen_welcome_bonus');

-- Check if columns are removed from jobs
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'jobs' 
-- AND column_name IN ('payment_id', 'payment_status', 'posting_fee_paid');

-- Check if columns are removed from bids
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'bids' 
-- AND column_name IN ('connection_payment_id', 'connection_payment_status', 'connection_fee_paid');

-- Check if functions are removed
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public'
-- AND routine_name IN ('process_transaction', 'check_wallet_balance', 'deduct_from_wallet', 'trigger_referral_reward');
