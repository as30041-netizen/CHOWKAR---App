-- ==========================================
-- FINAL SUBSCRIPTION RESCUE
-- Purpose: Prevent plan "reverts" (downgrades) caused by webhook race conditions.
-- Implementation: Plan Hierarchy + Smart Update
-- ==========================================

BEGIN;

-- 1. Helper Function: Get Plan Rank
CREATE OR REPLACE FUNCTION get_subscription_rank(p_plan TEXT) 
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE 
        WHEN p_plan = 'SUPER' THEN 4
        WHEN p_plan = 'PRO_POSTER' THEN 3
        WHEN p_plan = 'WORKER_PLUS' THEN 2
        WHEN p_plan = 'FREE' THEN 1
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Enhanced update_user_subscription with Anti-Downgrade Logic
CREATE OR REPLACE FUNCTION update_user_subscription(
    p_user_id UUID,
    p_new_plan TEXT,
    p_source TEXT,  -- 'PAYMENT', 'ADMIN', 'EXPIRY', 'DOWNGRADE'
    p_duration_days INTEGER DEFAULT 30,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_plan TEXT;
    v_old_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
    v_user_exists BOOLEAN;
BEGIN
    -- Validate plan
    IF p_new_plan NOT IN ('FREE', 'WORKER_PLUS', 'PRO_POSTER', 'SUPER') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid plan: ' || p_new_plan);
    END IF;
    
    -- Check if user exists and get current status
    SELECT subscription_plan, subscription_expiry INTO v_old_plan, v_old_expiry 
    FROM profiles WHERE id = p_user_id;

    IF v_old_plan IS NULL AND NOT EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    v_old_plan := COALESCE(v_old_plan, 'FREE');
    
    -- ==========================================
    -- ANTI-DOWNGRADE PROTECTION
    -- ==========================================
    -- If this is a payment-driven update (Webhook or Direct)
    IF p_source = 'PAYMENT' THEN
        -- If user is already on a HIGHER or EQUAL plan that hasn't expired
        IF get_subscription_rank(v_old_plan) > get_subscription_rank(p_new_plan) AND v_old_expiry > NOW() THEN
            -- IGNORE the update. This happens if a slower webhook (defaulting to WORKER_PLUS) 
            -- arrives after a faster direct verification (setting SUPER).
            RETURN jsonb_build_object(
                'success', true, 
                'message', 'Protected current higher plan (' || v_old_plan || ') from downgrade to ' || p_new_plan,
                'active_plan', v_old_plan,
                'retained', true
            );
        END IF;
    END IF;

    -- Calculate expiry
    v_new_expiry := CASE 
        WHEN p_new_plan = 'FREE' THEN NULL
        ELSE NOW() + (p_duration_days || ' days')::INTERVAL
    END;
    
    -- Update profile
    UPDATE profiles
    SET 
        subscription_plan = p_new_plan,
        subscription_expiry = v_new_expiry,
        is_premium = (p_new_plan != 'FREE'),
        verified = CASE 
            WHEN p_new_plan IN ('WORKER_PLUS', 'SUPER') THEN true
            ELSE verified 
        END,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log history
    INSERT INTO subscription_history (user_id, old_plan, new_plan, source, metadata, created_at)
    VALUES (p_user_id, v_old_plan, p_new_plan, p_source, p_metadata, NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'old_plan', v_old_plan,
        'new_plan', p_new_plan,
        'expiry', v_new_expiry,
        'source', p_source
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Robust admin_activate_premium wrapper
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
    v_notes JSONB;
BEGIN
    -- A. Extract planId (Try all known paths)
    v_plan_id := COALESCE(
        p_raw_event->'payload'->'payment'->'entity'->'notes'->>'planId',
        p_raw_event->'payload'->'order'->'entity'->'notes'->>'planId',
        p_raw_event->'notes'->>'planId',
        p_raw_event->>'planId'
    );

    -- B. Default to WORKER_PLUS if absolutely nothing found
    v_plan_id := COALESCE(v_plan_id, 'WORKER_PLUS');

    -- C. Delegate to protected service
    RETURN update_user_subscription(
        p_user_id,
        v_plan_id,
        'PAYMENT',
        30,
        jsonb_build_object(
            'event_id', p_event_id,
            'order_id', p_order_id,
            'reason', 'Razorpay Webhook/Verification',
            'detected_plan', v_plan_id
        )
    );
END;
$$;

COMMIT;
