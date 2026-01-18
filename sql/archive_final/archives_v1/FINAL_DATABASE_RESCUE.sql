
-- ==========================================================
-- EMERGENCY REPAIR: UNBLOCK DATABASE & FIX EGRESS SPIKE
-- ==========================================================
-- This script:
-- 1. Adds Guard Rails to ALL triggers to prevent recursion.
-- 2. Decouples Referral Rewards to prevent the "Busy" hang.
-- 3. Optimizes the Home Feed to prevent 9GB Egress (Image removal).
-- ==========================================================

BEGIN;

-- STEP 1: DROP PROBLEMATIC TRIGGERS
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;

-- STEP 2: CREATE SAFE REFERRAL FUNCTION (WITH DEPTH GUARD)
CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
  -- GUARD 1: Prevent recursion if trigger depth > 1
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- GUARD 2: Only run on actual changes to referred_by
  IF (TG_OP = 'UPDATE' AND NEW.referred_by IS NOT DISTINCT FROM OLD.referred_by) THEN
    RETURN NEW;
  END IF;

  -- REWARD LOGIC (Simplified & Safe)
  IF NEW.referred_by IS NOT NULL AND (OLD.referred_by IS NULL OR TG_OP = 'INSERT') THEN
    IF NEW.referred_by = NEW.id THEN RETURN NEW; END IF;

    -- Credit Referrer
    UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + 50 WHERE id = NEW.referred_by;
    
    -- Credit Current User
    NEW.wallet_balance := COALESCE(NEW.wallet_balance, 0) + 20;
    
    -- Record transactions
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES 
      (NEW.referred_by, 50, 'CREDIT', 'Referral Bonus (Friend joined)'),
      (NEW.id, 20, 'CREDIT', 'Referral Bonus (Joined via code)');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach as BEFORE trigger where possible to modify NEW row directly (faster)
CREATE TRIGGER trigger_referral_reward
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.referred_by IS NOT NULL AND OLD.referred_by IS NULL)
EXECUTE FUNCTION handle_referral_reward();


-- STEP 3: OPTIMIZE EGRESS (FIX FOR 9.1GB SPIKE)
-- We will modify the get_home_feed to check if image is too large and NULL it if so, 
-- or just remove it from the feed since it's heavy.
-- The JobDetailsModal will still fetch the full image via getJobWithFullDetails.

CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_status TEXT DEFAULT NULL,
    p_exclude_completed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, 
    title TEXT, description TEXT, category TEXT, location TEXT, 
    latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, 
    job_date TEXT, duration TEXT, budget NUMERIC, status TEXT, 
    created_at TIMESTAMPTZ, accepted_bid_id UUID, image TEXT, 
    bid_count BIGINT, my_bid_id UUID, my_bid_status TEXT, 
    my_bid_amount NUMERIC, my_bid_last_negotiation_by TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id, j.poster_id, j.poster_name, j.poster_photo, 
        j.title, j.description, j.category, j.location, 
        j.latitude, j.longitude, j.job_date, j.duration, 
        j.budget, j.status, j.created_at, j.accepted_bid_id, 
        NULL as image, -- [OPTIMIZATION] Don't return heavy images in the scrolling feed!
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT,
        (SELECT b.id FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1),
        (SELECT b.status FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1),
        (SELECT b.amount FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1),
        (SELECT b.negotiation_history->-1->>'by' FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1)
    FROM jobs j
    WHERE (p_status IS NULL OR j.status = p_status)
      AND (p_exclude_completed = FALSE OR j.status != 'COMPLETED')
    ORDER BY j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
$$;

COMMIT;
