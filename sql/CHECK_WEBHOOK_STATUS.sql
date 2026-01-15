-- Check if any webhooks were actually processed
SELECT * FROM public.processed_webhooks ORDER BY processed_at DESC LIMIT 5;

-- Check wallet transactions to see where the 20 coins came from
SELECT * FROM public.wallet_transactions 
WHERE wallet_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859' 
ORDER BY created_at DESC;
