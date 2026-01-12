-- ============================================
-- TEST 'YOU'RE HIRED' NOTIFICATION FLOW
-- ============================================
-- 1. Find a PENDING bid
-- 2. Simulate Acceptance (UPDATE status = 'ACCEPTED')
-- 3. Verify 'SUCCESS' Notification
-- ============================================

-- A. Setup Test Context (Find a Pending Bid)
CREATE TEMP TABLE IF NOT EXISTS test_hire_setup AS
SELECT 
    b.id as bid_id,
    b.job_id,
    b.worker_id, 
    j.poster_id,
    j.title as job_title
FROM bids b
JOIN jobs j ON j.id = b.job_id
WHERE b.status = 'PENDING' 
  AND j.status = 'OPEN'
LIMIT 1;

-- B. Execute Acceptance
WITH accepted_bid AS (
    UPDATE bids
    SET status = 'ACCEPTED'
    WHERE id = (SELECT bid_id FROM test_hire_setup)
    RETURNING id, status, worker_id, job_id
)
SELECT 
    '1. Bid Accepted' as step,
    id as bid_id,
    status as new_status
FROM accepted_bid;

-- C. Verify Notification
SELECT 
    '2. Hired Notification' as step,
    n.id as notif_id,
    n.title,
    n.message,
    n.type,
    n.user_id as recipient_worker
FROM notifications n
JOIN test_hire_setup th ON n.related_job_id = th.job_id
WHERE n.user_id = (SELECT worker_id FROM test_hire_setup)
  AND n.type = 'SUCCESS' -- Expecting "You're Hired! 🎉"
  AND n.created_at > (NOW() - INTERVAL '5 seconds');

-- D. Rollback (Cleanup to keep DB clean)
-- Ideally we would NOT rollback if we want to confirm UI, but for a pure logic test, we should cleanup.
-- However, since this modifies real data (Jobs/Bids), let's instruct the user to verify this manually or use a test job.
-- For this automated script, I will NOT revert it, assuming the user views this as a real test or I'd have to create dummy data.
-- DECISION: I will revert the change so I don't mess up their real data.

UPDATE bids 
SET status = 'PENDING' 
WHERE id = (SELECT bid_id FROM test_hire_setup);

DROP TABLE IF EXISTS test_hire_setup;
