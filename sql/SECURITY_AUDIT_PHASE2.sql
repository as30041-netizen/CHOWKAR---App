-- ========================================================
-- SECURITY AUDIT PHASE 2: DATA LEAKAGE PREVENTION & OPTIMIZATION
-- ========================================================
-- This script addresses findings from the second audit:
-- 1. CLEANUP public phone leakage in 'jobs' and 'bids' tables
-- 2. CREATE indexes for foreign keys (Performance)
-- 3. ENABLE RLS on Storage Buckets (if not already handled, though we focus on DB here)
-- ========================================================

BEGIN;

-- ========================================================
-- 1. PREVENT PHONE LEAKAGE (JOBS & BIDS)
-- ========================================================
-- Problem: 'jobs.poster_phone' and 'bids.worker_phone' are written by the frontend.
-- This effectively bypasses the profile security we just added.
-- Fix: We could Drop the columns, but that breaks existing 'SELECT *' queries in the frontend 
-- (which expect the field).
-- Strategy:
-- A. Make the columns Private via RLS? Not possible for columns.
-- B. Set them to NULL in the DB trigger (Sanitization)
--    AND
--    Update the Frontend to stop reading/writing them (already done for reading).
-- 
-- WE WILL CREATE TRIGGERS TO NULLIFY THESE FIELDS ON INSERT/UPDATE.
-- This allows the frontend to send them (legacy compat) but the DB ignores them.
-- NOTE: We must ensure 'get_job_contact' works. It reads from PROFILES, not jobs/bids. So this is safe.

CREATE OR REPLACE FUNCTION sanitize_sensitive_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Strip sensitive data from public tables
  -- We rely on JOINS to 'profiles' (securely) or RPCs to get this info.
  -- Storing it here is a duplication + leak check.
  
  -- Logic: If the table has these columns, set them to NULL.
  -- Since we can't genericize easily, we handle specific tables.
  
  IF TG_TABLE_NAME = 'jobs' THEN
     NEW.poster_phone := NULL;
  ELSIF TG_TABLE_NAME = 'bids' THEN
     NEW.worker_phone := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply to JOBS
DROP TRIGGER IF EXISTS trg_sanitize_jobs ON jobs;
CREATE TRIGGER trg_sanitize_jobs
BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION sanitize_sensitive_data();

-- Apply to BIDS
DROP TRIGGER IF EXISTS trg_sanitize_bids ON bids;
CREATE TRIGGER trg_sanitize_bids
BEFORE INSERT OR UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION sanitize_sensitive_data();

-- Retroactive Cleanup (OPTIONAL - Run manually if you want to wipe history)
-- UPDATE jobs SET poster_phone = NULL;
-- UPDATE bids SET worker_phone = NULL;


-- ========================================================
-- 2. PERFORMANCE INDEXES
-- ========================================================
-- Add indexes to frequently joined/filtered foreign keys to speed up RLS checks.

CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_bids_job_id ON bids(job_id);
CREATE INDEX IF NOT EXISTS idx_bids_worker_id ON bids(worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_job_id ON notifications(related_job_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_job_id ON chat_messages(job_id);
-- Compound index for chat history sorting
CREATE INDEX IF NOT EXISTS idx_chat_messages_job_created ON chat_messages(job_id, created_at DESC);

COMMIT;
