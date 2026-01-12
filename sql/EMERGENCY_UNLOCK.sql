-- EMERGENCY UNLOCK
-- Run this to force-kill stuck database connections and release locks

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid() -- Don't kill this script itself
AND (
  -- 1. Kill queries touching our tables
  query ILIKE '%jobs%' 
  OR query ILIKE '%bids%'
  OR query ILIKE '%profiles%'
  
  -- 2. Kill ZOMBIES (Idle transactions holding locks)
  OR state = 'idle in transaction'
  
  -- 3. Kill WAITING queries (Deadlocked)
  OR wait_event_type = 'Lock'
);
