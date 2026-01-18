-- ============================================================================
-- 🚀 CHOWKAR INDEX OPTIMIZATION PACK
-- ============================================================================

BEGIN;

-- 1. Optimize Home Feed (Status = OPEN, Ordered by CreatedAt)
-- Replaces single-column indexes for this specific query pattern
DROP INDEX IF EXISTS idx_jobs_status; -- Remove if exists (composite is better)
CREATE INDEX IF NOT EXISTS idx_jobs_status_created 
ON jobs(status, created_at DESC)
WHERE status = 'OPEN'; -- Partial index specifically for the feed! Extremely small and fast.

-- 2. Optimize "My Jobs" (Poster Dashboard)
-- Replaces idx_jobs_poster_id for sorting
CREATE INDEX IF NOT EXISTS idx_jobs_poster_created 
ON jobs(poster_id, created_at DESC);

-- 3. Optimize Unread Notifications Badge
-- This query runs on every page load/refresh
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id) 
WHERE read = false; 

-- 4. Optimize Chat List (Find latest message per chat)
-- Usually we query messages where job_id = ? order by created_at desc
CREATE INDEX IF NOT EXISTS idx_messages_job_created 
ON chat_messages(job_id, created_at DESC);

COMMIT;
