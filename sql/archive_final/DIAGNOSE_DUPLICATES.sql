
-- DIAGNOSTIC: CHECK FOR MISSING CONSTRAINTS & DUPLICATE WEBHOOKS

-- 1. Check if 'processed_webhooks' has duplicates (Schema Failure)
SELECT 
    event_id, 
    COUNT(*) as count 
FROM 
    processed_webhooks 
GROUP BY 
    event_id 
HAVING 
    COUNT(*) > 1;

-- 2. Check recent Wallet Transactions for duplicate Orders
SELECT 
    description, 
    COUNT(*) as count,
    MAX(created_at) as last_time
FROM 
    wallet_transactions
WHERE 
    created_at > NOW() - INTERVAL '1 hour'
GROUP BY 
    description
HAVING 
    COUNT(*) > 1;

-- 3. Check Table Constraints (Postgres specific)
SELECT 
    conname as constraint_name, 
    contype as constraint_type 
FROM 
    pg_constraint 
WHERE 
    conrelid = 'processed_webhooks'::regclass;
