-- ============================================================================
-- CHOWKAR MASTER POLICIES (02_policies.sql)
-- Consolidated Row Level Security - Jan 2026
-- ============================================================================

BEGIN;

-- ============================================
-- 1. JOBS
-- ============================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public jobs are viewable by everyone" ON jobs;
CREATE POLICY "Public jobs are viewable by everyone" ON jobs
FOR SELECT USING (true); -- Filtered logic is in RPC/UI, but row access is open

DROP POLICY IF EXISTS "Users can create jobs" ON jobs;
CREATE POLICY "Users can create jobs" ON jobs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Posters can update own jobs" ON jobs;
CREATE POLICY "Posters can update own jobs" ON jobs
FOR UPDATE TO authenticated USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Posters can delete own jobs" ON jobs;
CREATE POLICY "Posters can delete own jobs" ON jobs
FOR DELETE TO authenticated USING (auth.uid() = poster_id);


-- ============================================
-- 2. BIDS (High Security)
-- ============================================
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- A. Worker sees own bids
DROP POLICY IF EXISTS "Workers can view own bids" ON bids;
CREATE POLICY "Workers can view own bids" ON bids
FOR SELECT USING (auth.uid() = worker_id);

-- B. Poster sees bids for their jobs
DROP POLICY IF EXISTS "Posters can view bids on their jobs" ON bids;
CREATE POLICY "Posters can view bids on their jobs" ON bids
FOR SELECT USING (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = bids.job_id AND jobs.poster_id = auth.uid())
);

-- C. Updates (Strict)
DROP POLICY IF EXISTS "Workers can update own pending bids" ON bids;
CREATE POLICY "Workers can update own pending bids" ON bids
FOR UPDATE TO authenticated
USING (auth.uid() = worker_id AND status = 'PENDING')
WITH CHECK (auth.uid() = worker_id AND status = 'PENDING');

DROP POLICY IF EXISTS "Workers can delete own pending bids" ON bids;
CREATE POLICY "Workers can delete own pending bids" ON bids
FOR DELETE TO authenticated
USING (auth.uid() = worker_id AND status = 'PENDING');

-- Note: Bid Creation and Acceptance are handled via RPC (Security Definer) for safety.


-- ============================================
-- 3. PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- No DELETE policy (Use soft delete RPC)


-- ============================================
-- 4. WALLETS & TRANSACTIONS
-- ============================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
CREATE POLICY "Users can view own wallet" ON wallets
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
CREATE POLICY "Users can view own transactions" ON wallet_transactions
FOR SELECT USING (
    wallet_id IN (SELECT user_id FROM wallets WHERE user_id = auth.uid())
);


-- ============================================
-- 5. CHAT MESSAGES
-- ============================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chat messages they are part of" ON chat_messages;
CREATE POLICY "Users can view chat messages they are part of" ON chat_messages
FOR SELECT TO authenticated
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
CREATE POLICY "Users can send messages" ON chat_messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update (soft delete) own messages" ON chat_messages;
CREATE POLICY "Users can update (soft delete) own messages" ON chat_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid());


-- ============================================
-- 6. NOTIFICATIONS
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON notifications;
CREATE POLICY "Users can mark own notifications read" ON notifications
FOR UPDATE USING (auth.uid() = user_id);


-- ============================================
-- 7. REVIEWS
-- ============================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews viewable by everyone" ON reviews;
CREATE POLICY "Reviews viewable by everyone" ON reviews
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews" ON reviews
FOR INSERT TO authenticated
WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews" ON reviews
FOR UPDATE TO authenticated
USING (reviewer_id = auth.uid());


-- ============================================
-- 8. USER BLOCKS
-- ============================================
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own blocks" ON user_blocks;
CREATE POLICY "Users can view their own blocks" ON user_blocks
FOR SELECT TO authenticated
USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Users can create blocks" ON user_blocks;
CREATE POLICY "Users can create blocks" ON user_blocks
FOR INSERT TO authenticated
WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove blocks" ON user_blocks;
CREATE POLICY "Users can remove blocks" ON user_blocks
FOR DELETE TO authenticated
USING (blocker_id = auth.uid());


-- ============================================
-- 9. USER JOB VISIBILITY (Hide Card)
-- ============================================
ALTER TABLE user_job_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own visibility settings" ON user_job_visibility;
CREATE POLICY "Users can view their own visibility settings" ON user_job_visibility
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert visibility settings" ON user_job_visibility;
CREATE POLICY "Users can insert visibility settings" ON user_job_visibility
FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 10. SYSTEM TABLES
-- ============================================
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
-- Default deny all (Service Role only)

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own AI logs" ON ai_usage_logs;
CREATE POLICY "Users can view own AI logs" ON ai_usage_logs
FOR SELECT USING (user_id = auth.uid());

COMMIT;
