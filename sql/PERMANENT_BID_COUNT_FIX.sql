-- REPAIR BID COUNTS AT SOURCE
-- This script ensures the cached bid_count column is always accurate via triggers

BEGIN;

-- 1. Ensure the column exists and has an index for fast sorting/filtering
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_jobs_bid_count ON jobs(bid_count);

-- 2. Re-sync all counts once to fix existing discrepancies
UPDATE jobs j
SET bid_count = (
    SELECT COUNT(*) 
    FROM bids b 
    WHERE b.job_id = j.id
);

-- 3. Create the maintenance trigger
CREATE OR REPLACE FUNCTION sync_bid_count_at_source()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE jobs SET bid_count = bid_count + 1 WHERE id = NEW.job_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE jobs SET bid_count = GREATEST(0, bid_count - 1) WHERE id = OLD.job_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bid_count ON bids;
CREATE TRIGGER trg_sync_bid_count
AFTER INSERT OR DELETE ON bids
FOR EACH ROW EXECUTE FUNCTION sync_bid_count_at_source();

-- 4. Restore Full Permissions
GRANT ALL ON TABLE jobs TO authenticated;
GRANT ALL ON TABLE jobs TO anon;
GRANT ALL ON TABLE bids TO authenticated;
GRANT ALL ON TABLE bids TO anon;

COMMIT;
