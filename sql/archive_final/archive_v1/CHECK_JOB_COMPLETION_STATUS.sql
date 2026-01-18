-- ============================================
-- CHECK JOB COMPLETION NOTIFICATION SYSTEM
-- ============================================

-- 1. Check if there's a trigger for job completion
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
WHERE tgrelid = 'jobs'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2. Check if notify_on_job_completion function exists
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname LIKE '%job_completion%' OR p.proname LIKE '%complete%'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Check recent job completions and notifications
SELECT 
  j.id,
  j.title,
  j.status,
  j.updated_at,
  (SELECT COUNT(*) FROM notifications n WHERE n.related_job_id = j.id AND n.title LIKE '%Complete%') as completion_notifications
FROM jobs j
WHERE j.status = 'COMPLETED'
ORDER BY j.updated_at DESC
LIMIT 5;
