-- ADD PERFORMANCE INDEXES
-- Critical for Feed Performance and preventing Timeouts

BEGIN;

-- 1. Bids Foreign Keys & Status
CREATE INDEX IF NOT EXISTS idx_bids_job_id ON bids(job_id);
CREATE INDEX IF NOT EXISTS idx_bids_worker_id ON bids(worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- 2. Jobs Filtering & Sorting
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- 3. Composite for "Have I Bidded?" lookup (used in get_home_feed)
CREATE INDEX IF NOT EXISTS idx_bids_job_worker ON bids(job_id, worker_id);

-- 4. Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

COMMIT;
