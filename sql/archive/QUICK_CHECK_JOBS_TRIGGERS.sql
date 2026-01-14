-- Quick check: triggers on jobs table
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'jobs'::regclass
  AND NOT t.tgisinternal;
