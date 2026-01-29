-- CONSOLIDATED_BIDS_FIX.sql
-- 1. ADD MISSING COLUMN (Ensures expiration logic works)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_expiry') THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_expiry TIMESTAMPTZ;
    END IF;
END $$;

-- 2. FIX: Policy Function (Handles expiration AND corrects type mismatch)
CREATE OR REPLACE FUNCTION public.check_subscription_policy(
    p_user_id UUID,
    p_action TEXT -- 'POST_JOB' | 'PLACE_BID'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan TEXT;
    v_expiry TIMESTAMPTZ;
    v_count INT;
    v_limit INT;
    v_period_start TIMESTAMPTZ;
BEGIN
    -- Get User Plan & Expiry
    SELECT COALESCE(subscription_plan, 'FREE'), subscription_expiry 
    INTO v_plan, v_expiry
    FROM public.profiles
    WHERE id = p_user_id;

    -- Check Expiration (Downgrade to FREE if expired)
    IF v_plan != 'FREE' AND v_expiry IS NOT NULL AND v_expiry < NOW() THEN
        v_plan := 'FREE';
    END IF;

    -- ===========================
    -- ACTION: POST_JOB
    -- ===========================
    IF p_action = 'POST_JOB' THEN
        IF v_plan = 'PRO_POSTER' THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Pro Poster Plan');
        END IF;

        v_limit := 3;
        v_period_start := date_trunc('month', now());
        
        SELECT COUNT(*) INTO v_count
        FROM public.jobs
        WHERE poster_id = p_user_id
        AND created_at >= v_period_start; -- Fixed: Direct comparison

    -- ===========================
    -- ACTION: PLACE_BID
    -- ===========================
    ELSIF p_action = 'PLACE_BID' THEN
        IF v_plan = 'WORKER_PLUS' THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Worker Plus Plan');
        END IF;

        v_limit := 5;
        v_period_start := date_trunc('week', now()); 

        SELECT COUNT(*) INTO v_count
        FROM public.bids
        WHERE worker_id = p_user_id
        AND created_at >= v_period_start; -- Fixed: Direct comparison
        
    ELSE
        RETURN jsonb_build_object('allowed', false, 'reason', 'Invalid Action');
    END IF;

    IF v_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', 'Limit Reached', 
            'upgrade_required', true,
            'current_usage', v_count,
            'limit', v_limit
        );
    ELSE
        RETURN jsonb_build_object(
            'allowed', true, 
            'reason', 'Within Limit', 
            'current_usage', v_count,
            'limit', v_limit
        );
    END IF;
END;
$$;


-- 3. FIX: Bid Placement RPC (Ensures visibility and fires trigger correctly)
CREATE OR REPLACE FUNCTION public.action_place_bid(
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
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    v_worker_name TEXT;
    v_worker_phone TEXT;
    v_worker_rating NUMERIC;
    v_worker_location TEXT;
BEGIN
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    
    SELECT status, poster_id, title INTO v_job_status, v_poster_id, v_job_title FROM public.jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    IF v_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'Cannot bid on own job'); END IF;
    
    IF EXISTS (SELECT 1 FROM public.bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already bid on this job');
    END IF;

    SELECT name, phone, rating, location INTO v_worker_name, v_worker_phone, v_worker_rating, v_worker_location 
    FROM public.profiles WHERE id = v_worker_id;
    
    IF v_worker_name IS NULL THEN v_worker_name := 'Worker'; END IF;

    INSERT INTO public.bids (
        job_id, worker_id, amount, message, status, 
        worker_name, worker_phone, worker_rating, worker_location
    )
    VALUES (
        p_job_id, v_worker_id, p_amount, p_message, 'PENDING', 
        v_worker_name, v_worker_phone, v_worker_rating, v_worker_location
    )
    RETURNING id INTO v_new_bid_id;

    -- FIX: Use NOW() for created_at (TIMESTAMPTZ)
    INSERT INTO public.notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (v_poster_id, 'New Bid Received', 'Someone bid ₹' || p_amount || ' on ' || v_job_title, 'INFO', p_job_id, NOW());

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id, 'message', 'Bid placed successfully');
END;
$$;
