-- ============================================================================
-- SECURE PAYMENTS SYSTEM
-- 1. Idempotency Table (processed_webhooks)
-- 2. Secure Payment Processing RPC
-- ============================================================================

BEGIN;

-- 1. Create Idempotency Table
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    event_id TEXT PRIMARY KEY,
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'SUCCESS'
);

-- Enable RLS (Admin only)
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
-- No public policies needed as this is accessed via TRUSTED RPC only (or Service Role)

-- 2. Secure Process Payment RPC
-- This acts as a transactional wrapper for processing webhooks
CREATE OR REPLACE FUNCTION admin_process_payment_webhook(
    p_event_id TEXT,
    p_user_id UUID,
    p_amount INTEGER,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- A. Idempotency Check
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
    END IF;

    -- B. Verify User Exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- C. Credit Wallet
    UPDATE wallets 
    SET balance = balance + p_amount, 
        updated_at = NOW() 
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    -- If wallet missing (shouldn't happen for verified users, but safety first)
    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance) VALUES (p_user_id, p_amount)
        RETURNING balance INTO v_new_balance;
    END IF;

    -- D. Record Transaction
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE', 
        'Coin Purchase (Order: ' || p_order_id || ')', 
        (SELECT id FROM jobs LIMIT 0) -- NULL reference for now, or use order_id uuid if possible. Storing text in description.
    );
    -- Note: reference_id is UUID in schema, but Order ID is text (pay_...). 
    -- We store Order ID in description.

    -- E. Record Webhook as Processed
    INSERT INTO processed_webhooks (event_id, payload)
    VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

COMMIT;
