-- ==========================================
-- FIX: SUBSCRIPTION POLICY & SUPER PLAN
-- Purpose: 
-- 1. Ensure SUPER plan is recognized as Unlimited for both Jobs and Bids
-- 2. Fix TIMESTAMPTZ comparison issues (Operator does not exist)
-- 3. Ensure 'limit' is correctly returned for UI
-- ==========================================

BEGIN;

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
    -- 1. Get User Plan (Default to FREE)
    SELECT COALESCE(subscription_plan, 'FREE'), subscription_expiry 
    INTO v_plan, v_expiry
    FROM public.profiles
    WHERE id = p_user_id;

    -- Check Expiry (Downgrade to FREE if expired)
    IF v_plan != 'FREE' AND v_expiry IS NOT NULL AND v_expiry < NOW() THEN
        v_plan := 'FREE';
    END IF;

    -- ===========================
    -- ACTION: POST_JOB
    -- ===========================
    IF p_action = 'POST_JOB' THEN
        -- PRO_POSTER and SUPER get Unlimited Jobs
        IF v_plan IN ('PRO_POSTER', 'SUPER') THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Premium Unlimited Plan');
        END IF;

        v_limit := 3;
        v_period_start := date_trunc('month', now());
        
        -- FIX: Cast to epoch not needed if both are TIMESTAMPTZ, 
        -- but safety first: direct comparison is standard in Postgres 13+
        SELECT COUNT(*) INTO v_count
        FROM public.jobs
        WHERE poster_id = p_user_id
        AND created_at >= v_period_start;

    -- ===========================
    -- ACTION: PLACE_BID
    -- ===========================
    ELSIF p_action = 'PLACE_BID' THEN
        -- WORKER_PLUS and SUPER get Unlimited Bids
        IF v_plan IN ('WORKER_PLUS', 'SUPER') THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Premium Unlimited Plan');
        END IF;

        v_limit := 5;
        v_period_start := date_trunc('week', now()); 

        SELECT COUNT(*) INTO v_count
        FROM public.bids
        WHERE worker_id = p_user_id
        AND created_at >= v_period_start;
        
    ELSE
        RETURN jsonb_build_object('allowed', false, 'reason', 'Invalid Action');
    END IF;

    -- 3. Compare Results
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

COMMIT;
