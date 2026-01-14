-- ============================================
-- FIND ALL TRIGGERS ON BIDS TABLE
-- ============================================
-- Check for ANY triggers that might be firing on counter offers

-- Show ALL triggers on bids table (including system triggers)
SELECT 
  t.oid,
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
  CASE 
    WHEN t.tgtype & 64 = 64 THEN 'INSERT'
    WHEN t.tgtype & 32 = 32 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
  END as event,
  t.tgenabled as enabled,
  pg_get_triggerdef(t.oid) as full_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'bids'::regclass
  AND NOT t.tgisinternal  -- Exclude internal triggers
ORDER BY t.tgname;

-- Show functions that contain 'counter' in their name
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname LIKE '%counter%'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
