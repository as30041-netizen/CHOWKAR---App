-- DIAGNOSE BID COUNT ISSUE
-- Check the actual bids for a specific job

-- 1. List all jobs with their bid_count
SELECT 
  id,
  title,
  bid_count,
  created_at
FROM jobs
ORDER BY created_at DESC
LIMIT 5;

-- 2. For the most recent job, count actual bids
SELECT 
  j.id as job_id,
  j.title,
  j.bid_count as stored_count,
  COUNT(b.id) as actual_count
FROM jobs j
LEFT JOIN bids b ON b.job_id = j.id
GROUP BY j.id, j.title, j.bid_count
ORDER BY j.created_at DESC
LIMIT 5;

-- 3. Check if there are duplicate bids from same worker
SELECT 
  job_id,
  worker_id,
  COUNT(*) as bid_count,
  array_agg(id) as bid_ids
FROM bids
GROUP BY job_id, worker_id
HAVING COUNT(*) > 1;
