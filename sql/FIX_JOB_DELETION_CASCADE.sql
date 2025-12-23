-- ========================================================
-- FIX: JOB DELETION CASCADE
-- Ensures that when a job is deleted, all related records 
-- (bids, notifications, chats, etc.) are also removed.
-- ========================================================

-- Start transaction
BEGIN;

-- 1. BIDS table (Cascade deletion of job bids)
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_job_id_fkey;
ALTER TABLE bids ADD CONSTRAINT bids_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 2. CHATS table (Cascade deletion of chat rooms)
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_job_id_fkey;
ALTER TABLE chats ADD CONSTRAINT chats_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 3. CHAT_MESSAGES table (Cascade deletion of messages)
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_job_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 4. NOTIFICATIONS table (Cleanup notifications for deleted job)
-- Ensure related_job_id IS a foreign key with cascade
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_job_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_job_id_fkey 
  FOREIGN KEY (related_job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 5. TRANSACTIONS table (Cleanup job-related financial records)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_related_job_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_related_job_id_fkey 
  FOREIGN KEY (related_job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 6. REVIEWS table (Cleanup job reviews if job is deleted)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_job_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 7. PAYMENTS table (Cleanup payment tracking)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_related_job_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_related_job_id_fkey 
  FOREIGN KEY (related_job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- 8. USER_REPORTS table
ALTER TABLE user_reports DROP CONSTRAINT IF EXISTS user_reports_job_id_fkey;
ALTER TABLE user_reports ADD CONSTRAINT user_reports_job_id_fkey 
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

COMMIT;

-- Verify
-- Expected delete_rule: 'c' (CASCADE), 'a' (NO ACTION), 'r' (RESTRICT), 'n' (SET NULL), 'd' (SET DEFAULT)
SELECT conname, confrelid::regclass as ref_table, confdeltype as delete_rule
FROM pg_constraint
WHERE conrelid::regclass IN ('bids', 'chats', 'chat_messages', 'notifications', 'transactions', 'reviews', 'payments', 'user_reports')
AND confrelid::regclass = 'jobs'::regclass;
