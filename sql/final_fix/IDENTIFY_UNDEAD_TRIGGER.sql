-- ============================================================================
-- IDENTIFY_UNDEAD_TRIGGER.sql
-- ============================================================================
-- The Factory Reset failed because 2 triggers survived.
-- We need to know their names to kill them.
-- ============================================================================

SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'chat_messages' 
AND trigger_schema = 'public'
AND event_manipulation = 'INSERT';
