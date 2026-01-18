-- DEEP INSPECTION OF JOBS TABLE STATE
BEGIN;

-- 1. Check Active Triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'jobs';

-- 2. Check RLS Policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'jobs';

-- 3. Check for Active Locks/Queries currently running
SELECT 
  pid, 
  usename, 
  state, 
  age(clock_timestamp(), query_start) as duration,
  query
FROM pg_stat_activity 
WHERE query LIKE '%jobs%' 
AND pid != pg_backend_pid();

COMMIT;
