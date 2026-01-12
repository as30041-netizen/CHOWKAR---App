-- ============================================
-- DIAGNOSE TEST DATA AVAILABILITY
-- ============================================
-- Check if we have the necessary data to run tests
-- ============================================

-- 1. Check for PENDING bids
SELECT 
    COUNT(*) as pending_bid_count,
    'PENDING Bids Available' as check_type
FROM bids 
WHERE status = 'PENDING';

-- 2. Check for OPEN jobs with PENDING bids
SELECT 
    COUNT(DISTINCT b.id) as testable_bid_count,
    'OPEN Jobs with PENDING Bids' as check_type
FROM bids b
JOIN jobs j ON j.id = b.job_id
WHERE b.status = 'PENDING' 
  AND j.status = 'OPEN';

-- 3. Sample a few for manual inspection
SELECT 
    b.id as bid_id,
    b.job_id,
    b.status as bid_status,
    j.status as job_status,
    j.title as job_title,
    b.worker_id,
    j.poster_id
FROM bids b
JOIN jobs j ON j.id = b.job_id
WHERE b.status = 'PENDING' 
  AND j.status = 'OPEN'
LIMIT 3;

-- 4. If no PENDING bids, check what statuses exist
SELECT 
    status,
    COUNT(*) as count
FROM bids
GROUP BY status
ORDER BY count DESC;

-- 5. Check job statuses
SELECT 
    status,
    COUNT(*) as count
FROM jobs
GROUP BY status
ORDER BY count DESC;
