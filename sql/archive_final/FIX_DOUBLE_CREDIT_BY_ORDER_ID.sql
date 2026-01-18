
-- ============================================================================
-- FIX: DOUBLE CREDIT BUG (ULTIMATE FIX)
-- Strategy: Lock by ORDER ID, not just Event ID.
-- 1. Add order_id column to processed_webhooks.
-- 2. Add UNIQUE constraint on order_id.
-- 3. Update RPC to respect this constraint.
-- ============================================================================

BEGIN;

-- 1. Alter Table
ALTER TABLE public.processed_webhooks 
ADD COLUMN IF NOT EXISTS order_id TEXT;

-- 2. Create Unique Index (This is the shield)
-- We use partial index or just standard unique. Standard is fine as every webhook we care about has an order_id.
-- If order_id is null (some other event), it allows multiple nulls? Postgres allows multiple NULLs in unique index.
-- So this supports non-order webhooks if we ever have them.
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhooks_order_id 
ON public.processed_webhooks (order_id);

-- 3. Update the RPC to use this new constraint
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
    -- A. IDEMPOTENCY LOCK (ORDER ID LEVEL)
    -- We try to insert the Order ID. If it exists, we BLOCK.
    -- This handles the case where Razorpay sends 2 diff events for the same Order.
    BEGIN
        INSERT INTO processed_webhooks (event_id, payload, order_id)
        VALUES (p_event_id, p_raw_event, p_order_id);
    EXCEPTION WHEN unique_violation THEN
        -- Check which constraint failed
        RETURN json_build_object('success', true, 'message', 'Order already processed', 'idempotent', true);
    END;

    -- B. Verify User
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- C. Credit Wallet
    UPDATE wallets 
    SET balance = balance + p_amount, 
        updated_at = NOW() 
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance) VALUES (p_user_id, p_amount)
        RETURNING balance INTO v_new_balance;
    END IF;

    -- D. Transaction Log
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, reference_id)
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE', 
        'Coin Purchase (Order: ' || p_order_id || ')', 
        NULL -- We could store order_id here too if we changed schema, but sticking to Fix 1 for now.
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
