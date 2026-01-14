-- ============================================
-- TEST get_home_feed RPC DIRECTLY
-- ============================================
-- Check if the RPC exists and works
-- ============================================

-- 1. Check if function exists
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'get_home_feed';

-- 2. If it exists, test it with your user ID
SELECT * FROM get_home_feed('69c95415-770e-4da4-8bf8-25084ace911b')
LIMIT 5;

-- 3. Also check for other possible names
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%home%feed%' 
   OR proname LIKE '%job%feed%';
