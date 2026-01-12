-- ============================================
-- DEBUG QUERY: Check why worker can't see chats
-- Run each query separately to diagnose the issue
-- ============================================

-- 1. Find Jyoti's user ID (by name)
SELECT id, name, email FROM profiles WHERE name ILIKE '%jyoti%';

-- 2. Check all jobs with their accepted bids
-- Replace 'JYOTI_USER_ID' with actual UUID from step 1
SELECT 
  j.id as job_id,
  j.title,
  j.status,
  j.poster_id,
  j.accepted_bid_id,
  b.id as bid_id,
  b.worker_id,
  (SELECT name FROM profiles WHERE id = j.poster_id) as poster_name,
  (SELECT name FROM profiles WHERE id = b.worker_id) as worker_name
FROM jobs j
LEFT JOIN bids b ON b.id = j.accepted_bid_id
WHERE j.status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')
ORDER BY j.created_at DESC;

-- 3. Check bids placed by Jyoti
-- Replace 'JYOTI_USER_ID' with actual UUID
-- SELECT * FROM bids WHERE worker_id = 'JYOTI_USER_ID';

-- 4. Test the RPC directly for Jyoti
-- Replace 'JYOTI_USER_ID' with actual UUID
-- SELECT * FROM get_inbox_summaries('JYOTI_USER_ID');

-- 5. Check if any chat messages exist for Jyoti
-- SELECT * FROM chat_messages WHERE sender_id = 'JYOTI_USER_ID' OR receiver_id = 'JYOTI_USER_ID';
