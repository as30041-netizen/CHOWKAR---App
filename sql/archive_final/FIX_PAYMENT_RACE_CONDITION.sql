
-- ============================================================================
-- FIX: RACE CONDITION IN PAYMENT PROCESSING
-- Moving the Idempotency/Lock Insert to the START of the transaction.
-- This prevents two concurrent requests from both passing the 'Check' before one 'Inserts'.
-- ============================================================================

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
    -- A. Idempotency Lock (The Fix: Do this FIRST)
    -- We attempt to insert. If it fails (Unique Violation), it means another transaction 
    -- is processing or has processed this event.
    BEGIN
        INSERT INTO processed_webhooks (event_id, payload)
        VALUES (p_event_id, p_raw_event);
    EXCEPTION WHEN unique_violation THEN
        -- This block catches the race condition or duplicate retry
        RETURN json_build_object('success', true, 'message', 'Event already processed (Idempotent)', 'idempotent', true);
    END;

    -- B. Verify User Exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        -- NOTE: We technically inserted the webhook above. 
        -- If user is invalid, we might want to keep the webhook marked as 'failed' or delete it.
        -- For safety against infinite retries of bad data, keeping it as processed is often safer, 
        -- but let's update status if we had a status column. For now, just return error.
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
        (SELECT id FROM jobs LIMIT 0) -- NULL reference
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
    -- If any other error occurs (e.g. DB constraint), we return failure.
    -- The outer transaction rolls back, so the 'processed_webhooks' insert in Block A 
    -- is ALSO rolled back, allowing a retry. This is the desired behavior for genuine errors.
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
