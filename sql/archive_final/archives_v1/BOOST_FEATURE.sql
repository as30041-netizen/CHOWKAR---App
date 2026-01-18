-- ========================================================
-- FEATURE: JOB BOOSTING & BID HIGHLIGHTING (IMMEDIATE REVENUE)
-- ========================================================
-- This script adds:
-- 1. Support for 'Boosted' Jobs (Pinned at top)
-- 2. Support for 'Highlighted' Bids (Gold border)
-- 3. Payment RPCs to burn wallet credits
-- ========================================================

BEGIN;

-- 1. SCHEMA UPDATES
-- Add boosting fields to JOBS
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS boost_expiry TIMESTAMP WITH TIME ZONE;

-- Add highlighting fields to BIDS
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;

-- 2. RPC: BOOST JOB (Cost: ₹20 / 24 Hours)
CREATE OR REPLACE FUNCTION boost_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER;
  v_cost INTEGER := 20; -- Cost to boost
  v_duration INTERVAL := '24 hours';
BEGIN
  v_user_id := auth.uid();
  
  -- Check User Balance
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user_id;
  
  IF v_balance < v_cost OR v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance to boost job (Required: ₹%)', v_cost;
  END IF;

  -- Deduct Balance
  UPDATE public.profiles 
  SET wallet_balance = wallet_balance - v_cost 
  WHERE id = v_user_id;

  -- Record Transaction
  INSERT INTO public.transactions (user_id, amount, type, description, related_job_id)
  VALUES (v_user_id, v_cost, 'DEBIT', 'Job Boost 🚀', p_job_id);

  -- Apply Boost
  UPDATE public.jobs
  SET is_boosted = TRUE,
      boost_expiry = NOW() + v_duration
  WHERE id = p_job_id AND poster_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - v_cost);
END;
$$;

-- 3. RPC: HIGHLIGHT BID (Cost: ₹10)
CREATE OR REPLACE FUNCTION highlight_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER;
  v_cost INTEGER := 10; -- Cost to highlight
BEGIN
  v_user_id := auth.uid();
  
  -- Check Balance
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user_id;
  
  IF v_balance < v_cost OR v_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance to highlight bid (Required: ₹%)', v_cost;
  END IF;

  -- Deduct Balance
  UPDATE public.profiles 
  SET wallet_balance = wallet_balance - v_cost 
  WHERE id = v_user_id;

  -- Record Transaction
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_cost, 'DEBIT', 'Bid Highlight ✨');

  -- Apply Highlight
  UPDATE public.bids
  SET is_highlighted = TRUE
  WHERE id = p_bid_id AND worker_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - v_cost);
END;
$$;

-- 4. AUTO-EXPIRE BOOSTS
-- Create a function to clear expired boosts (can be called by cron or lazily check in view)
-- Ideally, we just check boost_expiry > NOW() in the frontend/query. 
-- But keeping data clean is good.
CREATE OR REPLACE FUNCTION clean_expired_boosts()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.jobs
  SET is_boosted = FALSE
  WHERE is_boosted = TRUE AND boost_expiry < NOW();
END;
$$;

COMMIT;
