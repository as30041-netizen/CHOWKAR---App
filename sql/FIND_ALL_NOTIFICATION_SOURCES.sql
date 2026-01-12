-- ============================================
-- FIND ALL NOTIFICATION SOURCES ON BIDS
-- ============================================

-- Show ALL triggers on bids table (not just counter-named ones)
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  t.tgenabled as enabled,
  CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
  CASE 
    WHEN t.tgtype & 64 = 64 THEN 'INSERT'
    WHEN t.tgtype & 32 = 32 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
  END as event
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Find ALL functions that insert into notifications table
SELECT DISTINCT p.proname as function_name
FROM pg_proc p
WHERE pg_get_functiondef(p.oid) LIKE '%INSERT INTO notifications%'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Check if there's a trigger on negotiation_history specifically
SELECT 
  t.tgname,
  p.proname,
  t.tgenabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
  AND (p.proname LIKE '%notify%' OR p.proname LIKE '%notification%');
