-- DEFINITIVE FIX: Create Webhook Processing Infrastructure
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Create Idempotency Table (if missing)
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    event_id TEXT PRIMARY KEY,
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'SUCCESS'
);

-- Enable RLS
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- 2. Create the Purchase Processing RPC
-- This creates/updates the exact function the Edge Function is looking for
CREATE OR REPLACE FUNCTION public.admin_process_payment_webhook(
    p_event_id TEXT,
    p_user_id UUID,
    p_amount INTEGER,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Essential: Runs with elevated permissions to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- A. Idempotency Check: Don't process the same event twice
    IF EXISTS (SELECT 1 FROM public.processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true);
    END IF;

    -- B. Verify User Exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found: ' || p_user_id::text);
    END IF;

    -- C. Credit Wallet (Atomic Update)
    UPDATE public.wallets 
    SET balance = balance + p_amount, 
        updated_at = NOW() 
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    -- If wallet missing, create it
    IF NOT FOUND THEN
        INSERT INTO public.wallets (user_id, balance, created_at, updated_at) 
        VALUES (p_user_id, p_amount, NOW(), NOW())
        RETURNING balance INTO v_new_balance;
    END IF;

    -- D. Record Transaction
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, created_at)
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE', 
        'Coin Purchase (Order: ' || p_order_id || ')', 
        NOW()
    );

    -- E. Record Webhook as Processed
    INSERT INTO public.processed_webhooks (event_id, payload)
    VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Create the Premium Activation RPC (if missing)
CREATE OR REPLACE FUNCTION public.admin_activate_premium(
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
    -- Idempotency Check
    IF EXISTS (SELECT 1 FROM public.processed_webhooks WHERE event_id = p_event_id) THEN
        RETURN json_build_object('success', true, 'message', 'Premium event already processed', 'idempotent', true);
    END IF;

    -- Update User Profile
    UPDATE public.profiles 
    SET is_premium = true, 
        updated_at = NOW() 
    WHERE id = p_user_id;

    -- Record Transaction
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, created_at)
    VALUES (p_user_id, 0, 'PREMIUM_UPGRADE', 'Lifetime Premium Upgrade (Order: ' || p_order_id || ')', NOW());

    -- Mark as processed
    INSERT INTO public.processed_webhooks (event_id, payload)
    VALUES (p_event_id, p_raw_event);

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;

-- VERIFICATION: Check if functions exist now
SELECT proname, pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname IN ('admin_process_payment_webhook', 'admin_activate_premium');
