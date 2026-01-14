-- ============================================================================
-- SYSTEM HEALTH CHECK & ANALYTICS
-- Run this to verify the overall state of the application data.
-- ============================================================================

BEGIN;

-- 1. OVERVIEW METRICS
SELECT 
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM jobs) as total_jobs,
    (SELECT COUNT(*) FROM jobs WHERE status = 'OPEN') as open_jobs,
    (SELECT COUNT(*) FROM bids) as total_bids,
    (SELECT COUNT(*) FROM wallets WHERE balance < 0) as negative_wallets_alerts,
    (SELECT SUM(amount) FROM wallet_transactions WHERE type = 'PURCHASE') as total_revenue_coins;

-- 2. INTEGRITY CHECKS (Should be empty)
-- A. Orphaned Bids (Job deleted but bid remains - should be caught by CASCADE)
SELECT 'Orphaned Bids' as issue, COUNT(*) 
FROM bids b LEFT JOIN jobs j ON b.job_id = j.id 
WHERE j.id IS NULL;

-- B. Invalid Job Status
SELECT 'Invalid Job Status' as issue, COUNT(*) 
FROM jobs 
WHERE status NOT IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- C. Users without Wallets
SELECT 'Users missing wallets' as issue, COUNT(*) 
FROM profiles p LEFT JOIN wallets w ON p.id = w.user_id 
WHERE w.user_id IS NULL;

-- 3. PERFORMANCE CHECKS (Index Usage - Requires pg_stat_user_indexes access)
-- checking if key indexes exist
SELECT 
    schemaname || '.' || tablename as table_name, 
    indexname 
FROM pg_indexes 
WHERE tablename IN ('jobs', 'bids', 'chat_messages') 
ORDER BY tablename, indexname;

COMMIT;
