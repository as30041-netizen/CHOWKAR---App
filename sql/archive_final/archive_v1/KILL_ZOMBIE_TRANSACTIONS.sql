-- TERMINATE STUCK TRANSACTIONS
-- Attempts to kill any connections that are "idle in transaction" and likely holding locks
-- Also kills long-running active queries (> 5 minutes)

SELECT 
    pg_terminate_backend(pid) as killed_pid,
    usename,
    state,
    query_start,
    query
FROM pg_stat_activity
WHERE 
    pid <> pg_backend_pid()
    AND datname = current_database()
    AND (
        state = 'idle in transaction' 
        OR (state = 'active' AND now() - query_start > interval '5 minutes')
    );
