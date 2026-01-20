-- ============================================================================
-- CHECK_LOOP_STATUS.sql
-- ============================================================================
-- DIAGNOSIS: Is the Database screaming (Loop) or is the App screaming (Client)?
-- ============================================================================

-- 1. How many notifications in the last 10 minutes?
SELECT 'NOTIFICATIONS_LAST_10_MIN' as metric, COUNT(*) as count 
FROM notifications 
WHERE created_at > (NOW() - INTERVAL '10 minutes');

-- 2. How many chat triggers fired in the last 10 minutes?
SELECT 'CHAT_TRIGGERS_LAST_10_MIN' as metric, COUNT(*) as count 
FROM push_debug_logs 
WHERE event = 'CHAT_TRIGGER' 
AND created_at > (NOW() - INTERVAL '10 minutes');

-- 3. Show the last 10 logs (Are they all the same second?)
SELECT * FROM push_debug_logs ORDER BY created_at DESC LIMIT 10;
