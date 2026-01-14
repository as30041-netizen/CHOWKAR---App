-- ============================================
-- TEST CHAT & NOTIFICATION SYNC (VERBOSE SELECT)
-- ============================================
-- Since DO blocks suppress output in some editors, 
-- this script uses direct SELECT statements to show results.
-- ============================================

-- 1. Find a Target Job (Store in temp table for reference)
CREATE TEMP TABLE IF NOT EXISTS test_context AS
SELECT 
    j.id as job_id, 
    j.poster_id, 
    b.worker_id 
FROM jobs j
JOIN bids b ON b.id = j.accepted_bid_id
WHERE j.status = 'IN_PROGRESS'
LIMIT 1;

-- 2. Insert Message (Poster -> Worker)
WITH new_msg AS (
    INSERT INTO chat_messages (job_id, sender_id, receiver_id, text)
    SELECT job_id, poster_id, worker_id, 'SYNC_TEST_VERBOSE_' || floor(random() * 1000)::text
    FROM test_context
    RETURNING id, text, created_at
)
SELECT 
    '1. Message Created' as step,
    id as record_id,
    text as details,
    created_at
FROM new_msg;

-- 3. Wait 100ms (Triggers are instant, but strict sequence helps)
-- Note: SQL doesn't have a simple "wait" that works everywhere, but the next query runs after.

-- 4. Check for Notification (Explicitly Select It)
SELECT 
    '2. Notification Check' as step,
    n.id as record_id,
    n.message as details,
    n.created_at
FROM notifications n
JOIN test_context tc ON n.related_job_id = tc.job_id
WHERE n.user_id = (SELECT worker_id FROM test_context)
  AND n.created_at > (NOW() - INTERVAL '10 seconds')
ORDER BY n.created_at DESC
LIMIT 1;

-- Clean up
DROP TABLE IF EXISTS test_context;
