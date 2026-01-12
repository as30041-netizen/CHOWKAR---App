-- ============================================
-- COMPREHENSIVE INBOX DIAGNOSTIC
-- ============================================
-- Find exact mismatch between chat_messages and get_inbox_summaries
-- ============================================

-- 1. Show ALL chat messages with job details
SELECT 
    cm.id as message_id,
    cm.job_id,
    j.title as job_title,
    j.status as job_status,
    j.poster_id,
    j.accepted_bid_id,
    cm.sender_id,
    cm.receiver_id,
    LEFT(cm.text, 30) as message_preview,
    cm.created_at
FROM chat_messages cm
JOIN jobs j ON j.id = cm.job_id
ORDER BY cm.created_at DESC
LIMIT 10;

-- 2. Check which jobs have messages but NO accepted_bid_id
SELECT 
    j.id as job_id,
    j.title,
    j.status,
    j.accepted_bid_id,
    COUNT(cm.id) as message_count,
    'Missing accepted_bid_id' as issue
FROM jobs j
JOIN chat_messages cm ON cm.job_id = j.id
WHERE j.accepted_bid_id IS NULL
GROUP BY j.id, j.title, j.status, j.accepted_bid_id;

-- 3. Check which jobs have messages but wrong status
SELECT 
    j.id as job_id,
    j.title,
    j.status,
    j.accepted_bid_id,
    COUNT(cm.id) as message_count,
    'Wrong status (not IN_PROGRESS/COMPLETED)' as issue
FROM jobs j
JOIN chat_messages cm ON cm.job_id = j.id
WHERE j.status NOT IN ('IN_PROGRESS', 'COMPLETED')
GROUP BY j.id, j.title, j.status, j.accepted_bid_id;

-- 4. Jobs that SHOULD appear in inbox (have messages + correct status + accepted_bid_id)
SELECT 
    j.id as job_id,
    j.title,
    j.status,
    j.poster_id,
    j.accepted_bid_id,
    b.worker_id,
    COUNT(cm.id) as message_count
FROM jobs j
LEFT JOIN chat_messages cm ON cm.job_id = j.id
LEFT JOIN bids b ON b.id = j.accepted_bid_id
WHERE j.status IN ('IN_PROGRESS', 'COMPLETED')
  AND j.accepted_bid_id IS NOT NULL
  AND cm.id IS NOT NULL
GROUP BY j.id, j.title, j.status, j.poster_id, j.accepted_bid_id, b.worker_id;
