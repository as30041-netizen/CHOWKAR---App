-- ============================================
-- EXAMINE THE BID EVENT NOTIFICATION FUNCTION
-- ============================================

-- Get the full definition of notify_on_bid_event
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'notify_on_bid_event'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
