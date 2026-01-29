-- ============================================================================
-- FIX_PAYMENT_RPC_FINAL.sql
-- ============================================================================
-- 1. Ensures 'order_id' column exists.
-- 2. Redefines 'admin_process_payment_webhook' to be robust and idempotent.
-- 3. Handles both 'type' and 'transaction_type' for compatibility.
-- ============================================================================

BEGIN;

-- 1. SCHEMA REPAIR: Ensure webhooks track Orders
ALTER TABLE public.processed_webhooks 
ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Index for fast lookups
DROP INDEX IF EXISTS idx_processed_webhooks_order_id;
CREATE UNIQUE INDEX idx_processed_webhooks_order_id 
ON public.processed_webhooks (order_id) 
WHERE order_id IS NOT NULL AND order_id != 'unknown';

-- 2. SCHEMA REPAIR: Ensure Wallet Transactions has all columns
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS transaction_type TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';

-- Drop restrictive constraints if they exist (using DO block to avoid errors)
DO $$ BEGIN
    ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 3. THE FIX: Robust Payment RPC
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
    v_already_processed BOOLEAN;
BEGIN
    -- A. IDEMPOTENCY CHECK (Order ID)
    -- This defines "Uniqueness". If we saw this Order ID before, it's a replay.
    IF p_order_id IS NOT NULL AND p_order_id != 'unknown' THEN
        SELECT EXISTS (SELECT 1 FROM processed_webhooks WHERE order_id = p_order_id) INTO v_already_processed;
        IF v_already_processed THEN
            -- Get current balance to return "success" even on replay
            SELECT balance INTO v_new_balance FROM wallets WHERE user_id = p_user_id;
            RETURN json_build_object('success', true, 'message', 'Order already processed', 'idempotent', true, 'new_balance', COALESCE(v_new_balance, 0));
        END IF;
    END IF;

    -- B. IDEMPOTENCY CHECK (Event ID - Fallback)
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        SELECT balance INTO v_new_balance FROM wallets WHERE user_id = p_user_id;
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true, 'new_balance', COALESCE(v_new_balance, 0));
    END IF;

    -- C. LOCK & REGISTER
    -- Use Order ID if available, otherwise Event ID
    INSERT INTO processed_webhooks (event_id, payload, order_id)
    VALUES (p_event_id, p_raw_event, p_order_id)
    ON CONFLICT (event_id) DO NOTHING; -- Should catch race conditions

    -- D. VERIFY USER
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- E. UPDATE WALLET
    -- Upsert logic: If wallet doesn't exist, create it.
    INSERT INTO wallets (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- F. LOG TRANSACTION
    -- Fill both 'type' (legacy) and 'transaction_type' (new)
    INSERT INTO wallet_transactions (
        wallet_id, 
        amount, 
        type, 
        transaction_type,
        description, 
        status,
        reference_id
    )
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE',       -- Legacy
        'CREDIT',         -- New Standard
        'Coin Purchase (Order: ' || COALESCE(p_order_id, 'Direct') || ')', 
        'COMPLETED',
        p_order_id
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't crash hard if possible, though needed for atomicity
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;
