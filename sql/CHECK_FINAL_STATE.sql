-- Final Verification of Wallet State
SELECT 
    w.user_id,
    w.balance,
    (SELECT count(*) FROM wallet_transactions WHERE wallet_id = w.user_id) as transaction_count,
    (SELECT count(*) FROM processed_webhooks) as total_webhooks_processed
FROM public.wallets w
WHERE w.user_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859';
