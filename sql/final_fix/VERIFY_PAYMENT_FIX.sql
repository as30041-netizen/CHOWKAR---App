-- ============================================================================
-- VERIFY_PAYMENT_FIX.sql
-- ============================================================================
-- Run this AFTER applying the fix to confirm it works.
-- It simulates a payment of 10 coins.
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- REPLACE WITH YOUR REAL USER ID
    v_result JSON;
    v_start_balance INTEGER;
    v_end_balance INTEGER;
BEGIN
    -- 1. Get User (Pick the first user if ID is dummy)
    IF v_user_id = '00000000-0000-0000-0000-000000000000' THEN
        SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Testing for User ID: %', v_user_id;

    -- 2. Get Starting Balance
    SELECT balance INTO v_start_balance FROM wallets WHERE user_id = v_user_id;
    RAISE NOTICE 'Starting Balance: %', COALESCE(v_start_balance, 0);

    -- 3. Call the RPC (Simulate 10 Coin Purchase)
    SELECT admin_process_payment_webhook(
        'evt_test_' || floor(random() * 10000)::text, -- unique event id
        v_user_id,
        10,                                           -- amount
        'order_test_' || floor(random() * 10000)::text, -- unique order id
        '{"source": "verification_script"}'::jsonb
    ) INTO v_result;

    RAISE NOTICE 'RPC Result: %', v_result;

    -- 4. Get Ending Balance
    SELECT balance INTO v_end_balance FROM wallets WHERE user_id = v_user_id;
    RAISE NOTICE 'Ending Balance: %', v_end_balance;

    -- 5. Validation
    IF (v_end_balance = COALESCE(v_start_balance, 0) + 10) THEN
         RAISE NOTICE '✅ SUCCESS: Wallet verified.';
    ELSE
         RAISE NOTICE '❌ FAILURE: Balance mismatch.';
    END IF;

END $$;
