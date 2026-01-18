-- ============================================================================
-- 🪙 ADD FUNDS RPC (MOCK / SECURE)
-- Handles successful payment events to top up the wallet
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION action_top_up_wallet(
    p_amount INTEGER,
    p_payment_ref TEXT,
    p_description TEXT DEFAULT 'Coin Purchase'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_new_balance INTEGER;
BEGIN
    -- 1. Validation
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- 2. Update Balance
    UPDATE wallets 
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_new_balance;

    -- Handle missing wallet edge case
    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance) VALUES (v_user_id, p_amount)
        RETURNING balance INTO v_new_balance;
    END IF;

    -- 3. Log Transaction
    INSERT INTO wallet_transactions (
        wallet_id, 
        amount, 
        type, 
        description, 
        reference_id
    )
    VALUES (
        v_user_id, 
        p_amount, 
        'PURCHASE', 
        p_description || ' (Ref: ' || p_payment_ref || ')',
        NULL -- Could store payment ID if UUID, but p_payment_ref is TEXT
    );

    RETURN json_build_object(
        'success', true, 
        'balance', v_new_balance,
        'added', p_amount
    );
END;
$$;

COMMIT;
