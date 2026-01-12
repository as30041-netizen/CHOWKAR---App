-- CHECK FOR ACTIVE LOCKS OR LONG RUNNING QUERIES
SELECT 
  pid, 
  usename, 
  state, 
  age(clock_timestamp(), query_start) as duration,
  query
FROM pg_stat_activity 
WHERE state != 'idle' 
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
