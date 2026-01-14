-- DROP NEW TRIGGER
-- Suspecting this trigger might be causing locks/deadlocks
-- We will rely on on-the-fly counts for 'bids' or 'my_bid_id' for now

DROP TRIGGER IF EXISTS trg_maintain_job_bid_count ON bids;
DROP FUNCTION IF EXISTS maintain_job_bid_count();
