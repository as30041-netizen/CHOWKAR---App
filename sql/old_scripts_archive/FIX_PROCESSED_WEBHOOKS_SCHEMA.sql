-- ============================================================================
-- FINAL SCHEMA SYNC: PROCESSED_WEBHOOKS
-- Fixes "column id does not exist" error
-- ============================================================================

BEGIN;

-- 1. FIX THE TABLE STRUCTURE
DO $$
BEGIN
    -- If 'id' is missing but 'event_id' is there, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'event_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'id') THEN
        ALTER TABLE public.processed_webhooks RENAME COLUMN event_id TO id;
        RAISE NOTICE 'Renamed event_id to id';
    END IF;

    -- If 'id' is still missing (totally new table or different schema), create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'id') THEN
        DROP TABLE IF EXISTS public.processed_webhooks;
        CREATE TABLE public.processed_webhooks (
            id TEXT PRIMARY KEY,
            event_id TEXT, -- Keep this for compatibility
            payload JSONB,
            processed_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Recreated table processed_webhooks with id column';
    END IF;

    -- Ensure 'event_id' exists as a helper column if we renamed it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'event_id') THEN
        ALTER TABLE public.processed_webhooks ADD COLUMN event_id TEXT;
        UPDATE public.processed_webhooks SET event_id = id;
    END IF;
END $$;

-- 2. RE-DEPLOY THE RPC (Identical logic, but guaranteed to match table)
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
    -- 1. ATOMIC LOCK
    BEGIN
        INSERT INTO processed_webhooks (id, event_id, payload)
        VALUES (p_event_id, p_event_id, p_raw_event);
    EXCEPTION WHEN unique_violation THEN
        RETURN json_build_object(
            'success', true, 
            'message', 'Already processed', 
            'idempotent', true
        );
    END;

    -- 2. Verify User
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- 3. Credit Wallet
    INSERT INTO wallets (user_id, balance)
    VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- 4. Record Transaction
    INSERT INTO wallet_transactions (
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
    RAISE EXCEPTION 'SQL ERROR: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO service_role;
GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO authenticated; -- Just in case

COMMIT;
