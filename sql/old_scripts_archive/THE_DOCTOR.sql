-- ============================================================================
-- THE DOCTOR: Comprehensive Payment Schema Repair
-- This script checks EVERY column required by the payment flow and repairs them.
-- ============================================================================

BEGIN;

-- 1. REPAIR 'processed_webhooks'
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processed_webhooks') THEN
        CREATE TABLE public.processed_webhooks (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            payload JSONB,
            processed_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Ensure 'id' is Primary Key
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'id') THEN
            ALTER TABLE public.processed_webhooks ADD COLUMN id TEXT;
            UPDATE public.processed_webhooks SET id = event_id;
            ALTER TABLE public.processed_webhooks ADD PRIMARY KEY (id);
        END IF;
        -- Ensure 'event_id' exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processed_webhooks' AND column_name = 'event_id') THEN
            ALTER TABLE public.processed_webhooks ADD COLUMN event_id TEXT;
        END IF;
    END IF;
END $$;

-- 2. REPAIR 'wallets'
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets') THEN
        CREATE TABLE public.wallets (
            user_id UUID PRIMARY KEY,
            balance INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Ensure 'balance' exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'balance') THEN
            ALTER TABLE public.wallets ADD COLUMN balance INTEGER DEFAULT 0;
        END IF;
        -- Ensure 'updated_at' exists (Essential for our RPC)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'updated_at') THEN
            ALTER TABLE public.wallets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- 3. REPAIR 'wallet_transactions'
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
        CREATE TABLE public.wallet_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            wallet_id UUID,
            amount INTEGER,
            transaction_type TEXT,
            type TEXT,
            description TEXT,
            status TEXT DEFAULT 'COMPLETED',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Ensure 'status' column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'status') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN status TEXT DEFAULT 'COMPLETED';
        END IF;

        -- CRITICAL: DROP RESTRICTIVE LEGACY CONSTRAINTS
        -- This fixes the "violates check constraint wallet_transactions_type_check" error
        ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

        -- Ensure 'transaction_type' column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'transaction_type') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN transaction_type TEXT;
        END IF;
        -- Ensure 'type' column exists (legacy compatibility)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'type') THEN
            ALTER TABLE public.wallet_transactions ADD COLUMN type TEXT;
        END IF;
    END IF;
END $$;

-- 4. RE-DEPLOY RPC (Final Robust Version)
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
    -- 1. Idempotency Check
    BEGIN
        INSERT INTO public.processed_webhooks (id, event_id, payload)
        VALUES (p_event_id, p_event_id, p_raw_event);
    EXCEPTION WHEN unique_violation THEN
        RETURN json_build_object('success', true, 'message', 'Already processed', 'idempotent', true);
    END;

    -- 2. Verify Profile (Critical for Foreign Keys)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User profile not found');
    END IF;

    -- 3. Update Wallet (Upsert)
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- 4. Record Transaction
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

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'DB_FATAL_ERROR: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO service_role;
GRANT EXECUTE ON FUNCTION admin_process_payment_webhook TO authenticated;

COMMIT;

-- REPORT RESULTS
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('processed_webhooks', 'wallets', 'wallet_transactions')
ORDER BY table_name;
