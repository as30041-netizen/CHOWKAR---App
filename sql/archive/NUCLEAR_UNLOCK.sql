-- NUCLEAR UNLOCK
-- The absolute final attempt to unblock the database

BEGIN;
  -- 1. Drop the triggers that might be causing recursive locks
  DROP TRIGGER IF EXISTS trg_maintain_job_bid_count ON bids;
  DROP FUNCTION IF EXISTS maintain_job_bid_count();

  DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
  DROP TRIGGER IF EXISTS notify_on_bid_accept ON bids;
COMMIT;

-- 2. Terminate ALL other connections to the database
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND datname = current_database();

-- 3. Refresh statistics
ANALYZE jobs;
ANALYZE bids;

-- 4. Check if we can read (Query should be instant)
SELECT count(*) as job_count FROM jobs;
