-- FIX_SUBSCRIPTION_PLAN_PARSING.sql
-- Purpose: Fix the 'admin_activate_premium' function to correctly extract 'planId' 
-- from the deep nested JSON structure of Razorpay Webhook Events.
-- Previously, it only looked at the top level, defaulting to 'WORKER_PLUS'.

BEGIN;

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
    -- 1. Try to extract 'planId' from Payment Notes (Most common)
    -- Path: payload -> payment -> entity -> notes -> planId
    v_notes := p_raw_event->'payload'->'payment'->'entity'->'notes';
    v_plan_id := v_notes->>'planId';

    -- 2. Fallback: Try Order Notes
    -- Path: payload -> order -> entity -> notes -> planId
    IF v_plan_id IS NULL THEN
        v_notes := p_raw_event->'payload'->'order'->'entity'->'notes';
        v_plan_id := v_notes->>'planId';
    END IF;

    -- 3. Fallback: Try Legacy Top-Level (If manually called)
    IF v_plan_id IS NULL THEN
        v_plan_id := p_raw_event->>'plan_id';
    END IF;

    -- 4. Default to WORKER_PLUS only if absolutely nothing found
    -- (This explains why PRO_POSTER users were getting WORKER_PLUS)
    v_plan_id := COALESCE(v_plan_id, 'WORKER_PLUS');

    -- Log for Debugging (Optional, generally printed to Postgres logs)
    RAISE NOTICE 'Activating Premium: User=%, Plan=%, Order=%', p_user_id, v_plan_id, p_order_id;

    -- 5. Update Profile
    UPDATE profiles
    SET 
        is_premium = true,
        verified = (CASE WHEN v_plan_id = 'WORKER_PLUS' THEN true ELSE verified END), -- Only auto-verify Workers
        subscription_plan = v_plan_id,
        subscription_expiry = NOW() + INTERVAL '30 days' -- Grant 30 Days
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Premium Activated',
        'plan', v_plan_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
