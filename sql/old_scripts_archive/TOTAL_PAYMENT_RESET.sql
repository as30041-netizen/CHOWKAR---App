-- ============================================================================
-- TOTAL RESET V2: PROCESSED_WEBHOOKS & WALLET_TRANSACTIONS
-- Fixes "column status does not exist" and ensures clean idempotency
-- ============================================================================

BEGIN;

-- 1. CLEAN SLATE FOR IDEMPOTENCY
DROP TABLE IF EXISTS public.processed_webhooks CASCADE;
CREATE TABLE public.processed_webhooks (
    id TEXT PRIMARY KEY, 
    event_id TEXT,       
    payload JSONB,       
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FIX WALLET_TRANSACTIONS SCHEMA
-- Ensure 'status' column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'status') THEN
        ALTER TABLE public.wallet_transactions ADD COLUMN status TEXT DEFAULT 'COMPLETED';
        RAISE NOTICE 'Added status column to wallet_transactions';
    END IF;

    -- Ensure 'type' column exists (legacy compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'type') THEN
        ALTER TABLE public.wallet_transactions ADD COLUMN type TEXT;
        RAISE NOTICE 'Added type column to wallet_transactions';
    END IF;
END $$;

-- 3. RE-DEPLOY THE RPC (Final Version)
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
    -- 1. IDEMPOTENCY LOCK
    BEGIN
        INSERT INTO public.processed_webhooks (id, event_id, payload)
        VALUES (p_event_id, p_event_id, p_raw_event);
    EXCEPTION WHEN unique_violation THEN
        RETURN json_build_object(
            'success', true, 
            'message', 'Already processed', 
            'idempotent', true
        );
    END;

    -- 2. VERIFY USER
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- 3. UPDATE WALLET
    INSERT INTO public.wallets (user_id, balance)
    VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- 4. RECORD HISTORY (Safe insert with columns we just verified)
    INSERT INTO public.wallet_transactions (
        wallet_id, 
        amount, 
        transaction_type, 
        type, 
        description, 
        status
    )
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE',
        'CREDIT',
        'Coin Purchase (Order: ' || p_order_id || ')', 
        'COMPLETED'
    );

    RETURN json_build_object(
        'success', true, 
        'new_balance', v_new_balance
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Internal DB Error: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO service_role;
GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO authenticated;

COMMIT;
