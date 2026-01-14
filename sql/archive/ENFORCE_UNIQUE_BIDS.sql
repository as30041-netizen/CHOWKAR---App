-- ============================================================================
-- 🛡️ TRANSACTION SAFETY: ENFORCE UNIQUE BIDS
-- Prevents double-bidding race conditions via Database Constraint
-- ============================================================================

BEGIN;

-- 1. CLEANUP DUPLICATES (If any exist from previous race conditions)
-- Keep the OLDEST bid (min id) and delete newer duplicates
DELETE FROM bids a 
USING bids b 
WHERE a.id > b.id 
AND a.job_id = b.job_id 
AND a.worker_id = b.worker_id;

-- 2. ADD UNIQUE CONSTRAINT
-- We use a CONSTRAINT instead of just an index to enforcing integrity
ALTER TABLE bids 
DROP CONSTRAINT IF EXISTS unique_bid_per_job_worker;

ALTER TABLE bids
ADD CONSTRAINT unique_bid_per_job_worker UNIQUE (job_id, worker_id);

-- 3. CLEANUP REDUNDANT INDEXES
-- The Unique Constraint creates its own index, so we can drop the plain one
DROP INDEX IF EXISTS idx_bids_composite;
DROP INDEX IF EXISTS idx_bids_job_worker;

COMMIT;
