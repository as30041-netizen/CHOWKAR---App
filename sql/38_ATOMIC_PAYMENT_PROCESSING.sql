-- ============================================================================
-- RPC: ATOMIC PAYMENT PROCESSING
-- Prevents Race Conditions & Double Crediting using Idempotency Lock
-- ============================================================================

-- OPTIONAL: Ensure table schema supports our lock
-- We use 'id' as the primary key for the Payment/Event ID to enforce uniqueness
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    id TEXT PRIMARY KEY, 
    event_id TEXT, -- Legacy / Secondary Reference
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- DROP FUNCTION first for clean replacement
DROP FUNCTION IF EXISTS admin_process_payment_webhook(TEXT, UUID, INTEGER, TEXT, JSONB);

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
    -- 1. ATOMIC LOCK (The 'Check-Then-Act' Fix)
    -- We try to Insert the Event ID *before* doing anything else.
    -- If this ID exists, the DB throws a Unique Violation immediately.
    -- This guarantees that multiple requests for the same Event ID cannot proceed.
    BEGIN
        INSERT INTO processed_webhooks (id, event_id, payload)
        VALUES (p_event_id, p_event_id, p_raw_event); -- Use event_id as PK
    EXCEPTION WHEN unique_violation THEN
        -- If we hit this, the event was already processed.
        -- We return success=true so the Payment Gateway stops retrying.
        RETURN json_build_object(
            'success', true, 
            'message', 'Event already processed (Idempotent)', 
            'idempotent', true
        );
    END;

    -- 2. Verify User Exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        -- If invalid user, we leave the webhook 'processed' (bad request shouldn't be retried)
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- 3. Credit Wallet & Get New Balance
    -- Use UPSERT pattern to handle missing wallets
    INSERT INTO wallets (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- 4. Record Transaction History
    INSERT INTO wallet_transactions (
        wallet_id, 
        amount, 
        transaction_type, 
        type, 
        description, 
        reference_id, 
        status
    )
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE',       -- Standard type
        'CREDIT',         -- Legacy type for compatibility
        'Coin Purchase (Order: ' || p_order_id || ')', 
        NULL,             -- Can link to a 'orders' table id if you have one
        'COMPLETED'
    );

    -- 5. Return Success
    RETURN json_build_object(
        'success', true, 
        'new_balance', v_new_balance,
        'message', 'Wallet credited successfully'
    );

EXCEPTION WHEN OTHERS THEN
    -- CRITICAL: If a database error occurs (e.g. disk full), we ROLLBACK.
    -- The Insert into processed_webhooks is undone, allowing a retry.
    RAISE EXCEPTION 'Payment processing failed: %', SQLERRM;
END;
$$;

-- Grant permissions (Admin only usually, but 'authenticated' if called via strict RLS/Edge Function)
GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO service_role;
