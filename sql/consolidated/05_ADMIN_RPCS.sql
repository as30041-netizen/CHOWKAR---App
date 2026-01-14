-- RPC for server-side wallet top-ups (e.g., from Webhooks)
CREATE OR REPLACE FUNCTION admin_top_up_wallet(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Insert into wallets if not exists (safety check)
  INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update Balance
  UPDATE wallets 
  SET balance = balance + p_amount 
  WHERE user_id = p_user_id 
  RETURNING balance INTO v_new_balance;

  -- Log Transaction
  INSERT INTO wallet_transactions (wallet_id, amount, type, description)
  VALUES (p_user_id, p_amount, 'PURCHASE', p_description);

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
