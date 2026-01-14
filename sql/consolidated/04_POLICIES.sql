-- ============================================================================
-- CHOWKAR MASTER POLICIES
-- Consolidated Row Level Security
-- ============================================================================

BEGIN;

-- 1. JOBS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public jobs are viewable by everyone" ON jobs
FOR SELECT USING (true);

CREATE POLICY "Users can create jobs" ON jobs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Posters can update own jobs" ON jobs
FOR UPDATE TO authenticated USING (auth.uid() = poster_id);

CREATE POLICY "Posters can delete own jobs" ON jobs
FOR DELETE TO authenticated USING (auth.uid() = poster_id);

-- 2. BIDS
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view own bids" ON bids
FOR SELECT USING (auth.uid() = worker_id);

CREATE POLICY "Posters can view bids on their jobs" ON bids
FOR SELECT USING (
    job_id IN (SELECT id FROM jobs WHERE poster_id = auth.uid())
);

CREATE POLICY "Workers can create bids" ON bids
FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Workers can update own bids" ON bids
FOR UPDATE TO authenticated USING (auth.uid() = worker_id);

-- 3. PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON profiles
FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 4. NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

-- 5. WALLETS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON wallets
FOR SELECT USING (auth.uid() = user_id);

COMMIT;
