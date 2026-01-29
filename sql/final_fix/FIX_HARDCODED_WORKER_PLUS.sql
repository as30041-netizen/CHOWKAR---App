-- ==========================================
-- FIX HARDCODED WORKER_PLUS IN PAYMENT ACTIVATION
-- Description: Updates admin_activate_premium to use actual plan_id from order
-- ==========================================

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
    v_expiry_date TIMESTAMPTZ;
BEGIN
    -- Extract plan_id from the Razorpay event payload
    -- The order.notes.planId contains the subscription plan
    v_plan_id := p_raw_event->'payload'->'order'->'entity'->'notes'->>'planId';
    
    -- Fallback to WORKER_PLUS if plan not found (shouldn't happen)
    IF v_plan_id IS NULL OR v_plan_id = '' THEN
        v_plan_id := 'WORKER_PLUS';
    END IF;
    
    -- Set expiry to 30 days from now
    v_expiry_date := NOW() + INTERVAL '30 days';
    
    -- Update user's subscription
    UPDATE profiles
    SET 
        is_premium = true,
        verified = true,
        subscription_plan = v_plan_id,  -- FIX: Use actual plan instead of hardcoded WORKER_PLUS
        subscription_expiry = v_expiry_date
    WHERE id = p_user_id;
    
    -- Return success with plan info
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Premium activated',
        'plan', v_plan_id,
        'expiry', v_expiry_date
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't crash
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
