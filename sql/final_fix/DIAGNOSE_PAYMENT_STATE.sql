-- ============================================================================
-- DIAGNOSE_PAYMENT_STATE.sql
-- ============================================================================
-- Run this BEFORE applying the fix to see the current state of your DB.
-- ============================================================================

-- 1. Check Table Columns (Do we have 'order_id' in processed_webhooks?)
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('processed_webhooks', 'wallets', 'wallet_transactions') 
ORDER BY table_name, ordinal_position;

-- 2. Check the Current RPC Definition (What arguments does it take?)
SELECT routine_name, routine_definition, external_language
FROM information_schema.routines 
WHERE routine_name = 'admin_process_payment_webhook';

-- 3. Check for specific arguments in the function signature
SELECT routine_name, parameter_name, data_type, ordinal_position
FROM information_schema.parameters
WHERE specific_name = 'admin_process_payment_webhook';

-- 4. Check Constraints (Are there any blocking constraints?)
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('wallets'::regclass, 'wallet_transactions'::regclass);
