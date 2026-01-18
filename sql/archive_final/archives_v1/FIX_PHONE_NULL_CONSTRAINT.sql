/*
  CRITICAL BUG FIX:
  The prompt error shows: "null value in column "poster_phone" of relation "jobs" violates not-null constraint"
  
  CONTEXT:
  In our security hardening (Phase 2), we implemented a TRIGGER to set `poster_phone` to NULL to prevent data leaks.
  HOWEVER, the database Schema still has a `NOT NULL` constraint on `poster_phone`.
  So when the Trigger runs (or even before), Postgres is complaining that we are inserting NULL into a NOT NULL column.
  
  FIX:
  We must RELAX the constraint. `poster_phone` and `worker_phone` in `jobs`/`bids` MUST be nullable if we want to "hide" them by setting them to NULL.
*/

BEGIN;

-- 1. Relax Constraints on JOBS table
ALTER TABLE jobs 
ALTER COLUMN poster_phone DROP NOT NULL;

-- 2. Relax Constraints on BIDS table
ALTER TABLE bids 
ALTER COLUMN worker_phone DROP NOT NULL;

-- 3. Verify Triggers exist (from previous step, but good to be safe)
-- (No action needed if they exist, but if we need to recreate them to be sure)
-- The function sanitize_sensitive_data() handles nullifying them.

COMMIT;
