-- ==========================================
-- UNIFIED PAYMENT ACTIVATION (THE BEST WAY)
-- Purpose: Use Price Mapping as the Definitive Source of Truth
-- to prevent metadata parsing errors from reverting plans.
-- ==========================================

BEGIN;

-- 1. Helper: Map Price to Plan
CREATE OR REPLACE FUNCTION map_price_to_plan(p_amount_paise INTEGER) 
RETURNS TEXT AS $$
BEGIN
    -- Razorpay amounts are in Paise (129 INR = 12900 Paise)
    -- We use a small range/tolerance just in case of tax adjustments, 
    -- but usually it's exact.
    RETURN CASE 
        WHEN p_amount_paise >= 12000 THEN 'SUPER'
        WHEN p_amount_paise >= 9000  THEN 'PRO_POSTER'
        WHEN p_amount_paise >= 4000  THEN 'WORKER_PLUS'
        ELSE 'FREE'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Master Activation Function
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
    v_amount_paise INTEGER;
    v_notes JSONB;
    v_result JSONB;
BEGIN
    -- A. Try to extract 'planId' from metadata (JSON parsing can be fragile)
    v_notes := p_raw_event->'payload'->'payment'->'entity'->'notes';
    v_plan_id := COALESCE(v_notes->>'planId', v_notes->>'plan_id');

    -- B. DEFINITIVE SOURCE OF TRUTH: Price Mapping
    -- If no planId was found, OR if we want to be 100% sure
    v_amount_paise := (p_raw_event->'payload'->'payment'->'entity'->>'amount')::INTEGER;
    
    -- If amount is present, price-based mapping OVERRIDES any default
    IF v_amount_paise IS NOT NULL AND v_amount_paise > 0 THEN
        v_plan_id := map_price_to_plan(v_amount_paise);
    END IF;

    -- C. Final Fallback (Should not be needed with Price Mapping)
    v_plan_id := COALESCE(v_plan_id, 'WORKER_PLUS');

    -- D. Log the detection for auditing
    RAISE NOTICE 'Payment Activation: User=%, Amount=%, Plan Detected=%', p_user_id, v_amount_paise, v_plan_id;

    -- E. Execute Activation
    SELECT update_user_subscription(
        p_user_id,
        v_plan_id,
        'PAYMENT',
        30,
        jsonb_build_object(
            'event_id', p_event_id,
            'order_id', p_order_id,
            'amount_paise', v_amount_paise,
            'detection_method', 'price_mapping'
        )
    ) INTO v_result;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
