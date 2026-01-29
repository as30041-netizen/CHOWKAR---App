-- PHASE 5: RAZORPAY INTEGRATION

-- 1. Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    order_id TEXT NOT NULL, -- Razorpay Order ID
    payment_id TEXT,        -- Razorpay Payment ID (Filled after success)
    amount INTEGER NOT NULL, -- Amount in Paies
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    plan_id TEXT NOT NULL,  -- WORKER_PLUS, PRO_POSTER
    created_at BIGINT DEFAULT extract(epoch from now())
);

-- 2. RPC to Create Order (Simulated for MVP)
-- In production, this would be an Edge Function calling Razorpay API
CREATE OR REPLACE FUNCTION create_payment_order(
    p_user_id UUID,
    p_plan_id TEXT,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id TEXT;
BEGIN
    -- Simulate Order ID generation
    v_order_id := 'order_' || floor(random() * 1000000)::text;

    INSERT INTO payments (user_id, order_id, amount, status, plan_id)
    VALUES (p_user_id, v_order_id, p_amount, 'PENDING', p_plan_id);

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'amount', p_amount,
        'currency', 'INR',
        'key', 'rzp_test_1DP5mmOlF5G5ag' -- Test Key injected here
    );
END;
$$;

-- 3. RPC to Verify Payment (Success Callback)
CREATE OR REPLACE FUNCTION verify_payment_success(
    p_order_id TEXT,
    p_payment_id TEXT,
    p_signature TEXT -- In real prod, verify this HMAC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    -- Find the payment record
    SELECT * INTO v_rec FROM payments WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- Update Payment Status
    UPDATE payments 
    SET status = 'SUCCESS', payment_id = p_payment_id
    WHERE order_id = p_order_id;

    -- UPDATE USER SUBSCRIPTION
    UPDATE profiles
    SET 
        subscription_plan = v_rec.plan_id,
        is_premium = true,
        verified = (CASE WHEN v_rec.plan_id = 'WORKER_PLUS' THEN true ELSE verified END) -- Auto verify for Worker Plus? Maybe
    WHERE id = v_rec.user_id;

    RETURN jsonb_build_object('success', true, 'new_plan', v_rec.plan_id);
END;
$$;
