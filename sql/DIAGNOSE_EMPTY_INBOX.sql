-- ============================================
-- DIAGNOSE CHAT INBOX EMPTINESS
-- ============================================
-- Check why get_inbox_summaries might return no results
-- ============================================

-- 1. Check if there are ANY chat messages
SELECT 
    COUNT(*) as total_messages,
    'Total Chat Messages' as check_type
FROM chat_messages;

-- 2. Check jobs that have chat messages
SELECT 
    j.id as job_id,
    j.title,
    j.status as job_status,
    j.poster_id,
    j.accepted_bid_id,
    COUNT(cm.id) as message_count
FROM jobs j
LEFT JOIN chat_messages cm ON cm.job_id = j.id
WHERE cm.id IS NOT NULL
GROUP BY j.id, j.title, j.status, j.poster_id, j.accepted_bid_id;

-- 3. Check if messages exist but for non IN_PROGRESS/COMPLETED jobs
SELECT 
    j.status,
    COUNT(DISTINCT cm.job_id) as jobs_with_chats,
    COUNT(cm.id) as total_messages
FROM chat_messages cm
JOIN jobs j ON j.id = cm.job_id
GROUP BY j.status;

-- 4. Sample some chat messages
SELECT 
    cm.id,
    cm.job_id,
    cm.sender_id,
    cm.receiver_id,
    LEFT(cm.text, 30) as text_preview,
    cm.created_at,
    j.status as job_status
FROM chat_messages cm
JOIN jobs j ON j.id = cm.job_id
ORDER BY cm.created_at DESC
LIMIT 5;

-- 5. Check if there are any IN_PROGRESS or COMPLETED jobs
SELECT 
    status,
    COUNT(*) as count
FROM jobs
WHERE status IN ('IN_PROGRESS', 'COMPLETED')
GROUP BY status;
