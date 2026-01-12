-- ============================================
-- INSPECT FUNCTION DEFINITION
-- ============================================
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'mark_messages_read';
