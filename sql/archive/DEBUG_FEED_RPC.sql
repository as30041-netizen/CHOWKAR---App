-- DEBUG FEED VISIBILITY
-- Run this to see what the database returns for the test user

-- 1. Check if ANY bids exist for the user
SELECT 'Direct Table Check' as check_type, id, job_id, status 
FROM bids 
WHERE worker_id = 'e266fa3d-d854-4445-be8b-cd054a2fa859';

-- 2. Check what the RPC returns (If my_bid_id is NULL here, the subquery is failing)
SELECT 
    'RPC Result' as check_type,
    id as job_id, 
    title, 
    my_bid_id, 
    my_bid_status
FROM get_home_feed('e266fa3d-d854-4445-be8b-cd054a2fa859', 10, 0, false)
WHERE my_bid_id IS NOT NULL; -- Show only applied checks
