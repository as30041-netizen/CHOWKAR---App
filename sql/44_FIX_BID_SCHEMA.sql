-- ============================================================================
-- SQL: FIX BID SCHEMA (Phase 44)
-- Purpose: Add missing 'accepted_at' column to bids table and update accept_bid RPC.
--          This fixes the "column does not exist" error during hiring.
-- ============================================================================

BEGIN;

-- 1. Add missing column 'accepted_at' to bids table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bids' AND column_name = 'accepted_at') THEN
        ALTER TABLE bids ADD COLUMN accepted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- 2. Update ACCEPT_BID RPC to populate this column
DROP FUNCTION IF EXISTS accept_bid(UUID, UUID, UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION accept_bid(
  p_job_id UUID,
  p_bid_id UUID,
  p_poster_id UUID,
  p_worker_id UUID,
  p_amount INTEGER,
  p_poster_fee INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_status TEXT;
  v_bid_status TEXT;
  v_bid_exists BOOLEAN;
BEGIN
  -- 1. LOCK the job row to prevent race conditions (Double Hire)
  SELECT status INTO v_job_status FROM jobs WHERE id = p_job_id FOR UPDATE;
  
  IF v_job_status IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job_status != 'OPEN' THEN
    RAISE EXCEPTION 'Job is not open for bidding (current status: %)', v_job_status;
  END IF;

  -- 2. Verify Bid Status (Ghost Bid Check)
  SELECT status, TRUE INTO v_bid_status, v_bid_exists FROM bids WHERE id = p_bid_id;
  
  IF v_bid_exists IS NULL THEN
     RAISE EXCEPTION 'Bid not found (User may have withdrawn)';
  END IF;

  IF v_bid_status = 'REJECTED' THEN
     RAISE EXCEPTION 'Cannot accept a withdrawn/rejected bid.';
  END IF;

  -- 3. Update job status to IN_PROGRESS
  UPDATE jobs
  SET 
    status = 'IN_PROGRESS',
    accepted_bid_id = p_bid_id,
    updated_at = NOW()
  WHERE id = p_job_id;

  -- 4. Update accepted bid status AND accepted_at timestamp
  UPDATE bids
  SET 
    status = 'ACCEPTED',
    accepted_at = NOW(), -- Populate the new column
    updated_at = NOW()
  WHERE id = p_bid_id;

  -- 5. Reject all other PENDING bids
  UPDATE bids
  SET 
    status = 'REJECTED',
    updated_at = NOW()
  WHERE job_id = p_job_id 
    AND id != p_bid_id 
    AND status = 'PENDING';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bid accepted successfully'
  );
END;
$$;

COMMIT;

-- End of Script
