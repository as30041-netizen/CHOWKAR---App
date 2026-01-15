-- ============================================================================
-- ACTIVATE PREMIUM RPC
-- Sets is_premium = true for a user and records the transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_activate_premium(
    p_event_id TEXT,
    p_user_id UUID,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- A. Idempotency Check
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
    END IF;

    -- B. Verify User Exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- C. Activate Premium
    UPDATE profiles 
    SET is_premium = true, 
        updated_at = NOW() 
    WHERE id = p_user_id;

    -- D. Record Transaction (Accounting for Premium Purchase)
    INSERT INTO wallet_transactions (wallet_id, amount, type, description)
    VALUES (
        p_user_id, 
        0, -- It's a binary state change, not a coin addition, but we record it
        'PURCHASE', 
        'Premium Upgrade (Order: ' || p_order_id || ')'
    );

    -- E. Record Webhook as Processed
    INSERT INTO processed_webhooks (event_id, payload)
    VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true, 'is_premium', true);
END;
$$;
