-- ============================================
-- FIX BID COUNT INTEGRITY (RECALCULATE & SYNC)
-- 1. Recalculate all bid counts from actual data
-- 2. Ensure trigger is optimized and accurate
-- ============================================

-- 1. DATA RE-SYNC (The "Hard Reset")
-- This forces the bid_count to match the actual number of rows in the bids table
UPDATE jobs j
SET bid_count = (
    SELECT COUNT(*) 
    FROM bids b 
    WHERE b.job_id = j.id
);

-- 2. ENHANCED TRIGGER (Self-Correcting)
-- Instead of +1 / -1, we make the trigger perform a fresh count for maximum accuracy
CREATE OR REPLACE FUNCTION update_job_bid_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'DELETE') THEN
        UPDATE jobs 
        SET bid_count = (SELECT COUNT(*) FROM bids WHERE job_id = COALESCE(NEW.job_id, OLD.job_id))
        WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS trg_update_bid_count ON bids;
CREATE TRIGGER trg_update_bid_count
AFTER INSERT OR DELETE ON bids
FOR EACH ROW EXECUTE FUNCTION update_job_bid_count();

DO $$ BEGIN
  RAISE NOTICE '✅ Bid counts synchronized and integrity trigger updated.';
END $$;
