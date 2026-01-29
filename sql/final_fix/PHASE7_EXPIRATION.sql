-- PHASE 7: SUBSCRIPTION EXPIRATION LOGIC
-- Purpose: Add expiration mechanism (30 Days) for Subscriptions.

BEGIN;

-- 1. ADD COLUMN
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_expiry') THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_expiry TIMESTAMPTZ;
    END IF;
END $$;

-- 2. UPDATE 'admin_activate_premium' (Set 30 Days Validity)
-- This RPC is called by the Razorpay Edge Function on successful payment.
CREATE OR REPLACE FUNCTION admin_activate_premium(
    p_event_id TEXT,
    p_user_id UUID,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_id TEXT;
BEGIN
    -- Extract Plan ID (Default to WORKER_PLUS if missing)
    v_plan_id := COALESCE(p_raw_event->>'plan_id', 'WORKER_PLUS');

    -- Update Profile with Expiry
    UPDATE profiles
    SET 
        is_premium = true,
        verified = (CASE WHEN v_plan_id = 'WORKER_PLUS' THEN true ELSE verified END), -- Only verify Workers
        subscription_plan = v_plan_id,
        subscription_expiry = NOW() + INTERVAL '30 days' -- Grant 30 Days
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Premium Activated with 30 Days Validity');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- 3. UPDATE POLICY FUNCTION (Enforce Expiry)
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
    v_expiry TIMESTAMPTZ;
    v_count INT;
    v_limit INT;
    v_period_start TIMESTAMPTZ;
BEGIN
    -- 1. Get User Plan & Expiry
    SELECT COALESCE(subscription_plan, 'FREE'), subscription_expiry 
    INTO v_plan, v_expiry
    FROM profiles
    WHERE id = p_user_id;

    -- 2. Check Expiration (Downgrade Logic)
    IF v_plan != 'FREE' AND v_expiry IS NOT NULL AND v_expiry < NOW() THEN
        v_plan := 'FREE';
        -- Note: We generally don't UPDATE here to keep it read-only, 
        -- but effectively the user is treated as FREE.
    END IF;

    -- ===========================
    -- ACTION: POST_JOB
    -- ===========================
    IF p_action = 'POST_JOB' THEN
        IF v_plan = 'PRO_POSTER' THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Pro Poster Plan');
        END IF;

        -- Free Limit: 3 per month
        v_limit := 3;
        v_period_start := date_trunc('month', now());
        
        SELECT COUNT(*) INTO v_count
        FROM jobs
        WHERE poster_id = p_user_id
        AND created_at >= extract(epoch from v_period_start);

    -- ===========================
    -- ACTION: PLACE_BID
    -- ===========================
    ELSIF p_action = 'PLACE_BID' THEN
        IF v_plan = 'WORKER_PLUS' THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Worker Plus Plan');
        END IF;

        -- Free Limit: 5 per WEEK
        v_limit := 5;
        v_period_start := date_trunc('week', now()); 

        SELECT COUNT(*) INTO v_count
        FROM bids
        WHERE worker_id = p_user_id
        AND created_at >= extract(epoch from v_period_start);
        
    ELSE
        RETURN jsonb_build_object('allowed', false, 'reason', 'Invalid Action');
    END IF;

    -- 3. Compare Results
    IF v_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', 'Limit Reached (Plan: ' || v_plan || ')', 
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
