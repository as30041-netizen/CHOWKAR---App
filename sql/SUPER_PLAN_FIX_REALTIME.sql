-- ==========================================
-- PHASE 3.5: SUPER PLAN FIXES & REALTIME
-- ==========================================

BEGIN;

-- 1. Update check_subscription_policy to include SUPER plan
CREATE OR REPLACE FUNCTION check_subscription_policy(
    p_user_id UUID,
    p_action TEXT -- 'POST_JOB' | 'PLACE_BID'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan TEXT;
    v_count INT;
    v_limit INT;
    v_period_start TIMESTAMPTZ;
BEGIN
    -- 1. Get User Plan (Default to FREE)
    SELECT COALESCE(subscription_plan, 'FREE') INTO v_plan
    FROM profiles
    WHERE id = p_user_id;

    -- 2. Define Limits based on Plan & Action
    IF p_action = 'POST_JOB' THEN
        -- UNLIMITED tiers for Posting
        IF v_plan IN ('PRO_POSTER', 'SUPER') THEN
            RETURN jsonb_build_object('allowed', true, 'reason', v_plan || ' Plan');
        END IF;

        -- Free Limit: 3 per month
        v_limit := 3;
        v_period_start := date_trunc('month', now());
        
        -- Count usage
        SELECT COUNT(*) INTO v_count
        FROM jobs
        WHERE poster_id = p_user_id
        AND created_at >= extract(epoch from v_period_start);

    ELSIF p_action = 'PLACE_BID' THEN
        -- UNLIMITED tiers for Bidding
        IF v_plan IN ('WORKER_PLUS', 'SUPER') THEN
            RETURN jsonb_build_object('allowed', true, 'reason', v_plan || ' Plan');
        END IF;

        -- Free Limit: 5 per WEEK
        v_limit := 5;
        v_period_start := date_trunc('week', now()); -- Starts Monday

        -- Count usage
        SELECT COUNT(*) INTO v_count
        FROM bids
        WHERE worker_id = p_user_id
        AND created_at >= extract(epoch from v_period_start);
        
    ELSE
        RETURN jsonb_build_object('allowed', false, 'reason', 'Invalid Action');
    END IF;

    -- 3. Compare
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

-- 2. Enable Realtime for Profiles (CRITICAL for real-time UI updates)
-- First check if the publication exists, then add the table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Table already in publication
        NULL;
END $$;

COMMIT;
