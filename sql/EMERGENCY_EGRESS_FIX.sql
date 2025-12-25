
-- ==========================================================
-- EMERGENCY EGRESS & PERFORMANCE FIX (V3)
-- ==========================================================
-- Fixes "tg_op does not exist" in WHEN clause and 
-- enforces 9GB bandwidth reduction.
-- ==========================================================

BEGIN;

-- 1. DROP FUNCTIONS FIRST TO CLEAR SIGNATURE CONFLICTS
DROP FUNCTION IF EXISTS get_home_feed(uuid, int, int, text, boolean);
DROP FUNCTION IF EXISTS get_my_applications_feed(uuid, int, int);
DROP FUNCTION IF EXISTS get_my_jobs_feed(uuid, int, int);

-- 2. RE-CREATE HOME FEED (Stripped images for 9GB Fix)
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
        NULL as image, -- BANDWIDTH FIX: Don't load base64 in list
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

-- 3. RE-CREATE MY APPLICATIONS FEED (Stripped images)
CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
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
        NULL as image, -- BANDWIDTH FIX
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT,
        b.id as my_bid_id, b.status as my_bid_status, b.amount as my_bid_amount,
        b.negotiation_history->-1->>'by' as my_bid_last_negotiation_by
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    WHERE b.worker_id = p_user_id
    ORDER BY j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
$$;

-- 4. RE-CREATE MY JOBS (POSTER) FEED (Stripped images)
CREATE OR REPLACE FUNCTION get_my_jobs_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID, poster_id UUID, poster_name TEXT, poster_photo TEXT, 
    title TEXT, description TEXT, category TEXT, location TEXT, 
    latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, 
    job_date TEXT, duration TEXT, budget NUMERIC, status TEXT, 
    created_at TIMESTAMPTZ, accepted_bid_id UUID, image TEXT, 
    bid_count BIGINT, last_bid_negotiation_by TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id, j.poster_id, j.poster_name, j.poster_photo, 
        j.title, j.description, j.category, j.location, 
        j.latitude, j.longitude, j.job_date, j.duration, 
        j.budget, j.status, j.created_at, j.accepted_bid_id, 
        NULL as image, -- BANDWIDTH FIX
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT,
        (SELECT b.negotiation_history->-1->>'by' FROM bids b WHERE b.job_id = j.id ORDER BY b.updated_at DESC LIMIT 1)
    FROM jobs j
    WHERE j.poster_id = p_user_id
    ORDER BY j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
$$;

-- 5. HARDENED TRIGGER GUARD (RECURSION PROOF)
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;

CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent infinite loops
    IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
    
    -- Check if we are inserting with a referral OR updating from NULL to value
    IF (TG_OP = 'INSERT' AND NEW.referred_by IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.referred_by IS NOT NULL AND OLD.referred_by IS NULL) THEN
        
        -- Credit Referrer Wallet
        UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + 50 WHERE id = NEW.referred_by;
        
        -- Credit Current User Wallet (Direct modify NEW row)
        NEW.wallet_balance := COALESCE(NEW.wallet_balance, 0) + 20;

        -- Record minimal transaction trail
        INSERT INTO public.transactions (user_id, amount, type, description)
        VALUES (NEW.id, 20, 'CREDIT', 'Referral Bonus');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers cleanly (WHEN clause moved into function logic for robustness)
DROP TRIGGER IF EXISTS trigger_referral_reward_insert ON public.profiles;
CREATE TRIGGER trigger_referral_reward_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_referral_reward();

DROP TRIGGER IF EXISTS trigger_referral_reward_update ON public.profiles;
CREATE TRIGGER trigger_referral_reward_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_referral_reward();

COMMIT;
