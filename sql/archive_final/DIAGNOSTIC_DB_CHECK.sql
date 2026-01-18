-- Diagnostic: Check if RPCs exist
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    l.lanname as language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('admin_process_payment_webhook', 'admin_activate_premium');

-- Check if any errors are occurring in the database logs (if possible via table)
-- (Supabase doesn't expose a log table usually, but we can check if wallets have unexpected state)
SELECT user_id, balance, updated_at FROM public.wallets WHERE user_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859';

-- Check all transactions for this user
SELECT * FROM public.wallet_transactions WHERE wallet_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859' ORDER BY created_at DESC;
