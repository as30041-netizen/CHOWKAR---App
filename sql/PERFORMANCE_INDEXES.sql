-- PERFORMANCE INDEXES 
-- Critical for app speed as data grows

-- 1. Jobs: Filtering by poster and status
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location); -- For search

-- 2. Bids: Finding bids for a job or worker
CREATE INDEX IF NOT EXISTS idx_bids_job_id ON bids(job_id);
CREATE INDEX IF NOT EXISTS idx_bids_worker_id ON bids(worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);

-- 3. Notifications: User fetching their feed
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- 4. Transactions: User history
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- 5. Chat: Loading conversation
CREATE INDEX IF NOT EXISTS idx_chat_job_id ON chat_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);

-- 6. Reviews: Fetching user reputation
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
