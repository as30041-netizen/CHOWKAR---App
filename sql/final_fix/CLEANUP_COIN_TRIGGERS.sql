-- CLEANUP: Remove Legacy Coin Logic and Triggers
-- This ensures no conflicting "Coin Deduction" logic runs alongside the Subscription System.

-- 1. Drop Job Posting Coin Deduction
DROP TRIGGER IF EXISTS tr_deduct_coins ON jobs;
DROP FUNCTION IF EXISTS deduct_coins_for_job();

-- 2. Drop Bid Coin Deduction
DROP TRIGGER IF EXISTS tr_deduct_coins_bid ON bids;
DROP FUNCTION IF EXISTS deduct_coins_for_bid();
DROP FUNCTION IF EXISTS public.deduct_coins_for_bid();

-- 3. Drop Wallet Limits Checks (if implemented as triggers)
DROP TRIGGER IF EXISTS check_wallet_balance ON jobs;
DROP TRIGGER IF EXISTS tr_check_wallet_balance ON jobs;

-- 4. Mark cleanup as complete
SELECT 'Legacy Coin Triggers Dropped' as status;
