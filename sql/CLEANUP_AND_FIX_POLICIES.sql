-- CLEANUP AND STANDARDIZE SECURITY POLICIES v2
-- Aggressive cleanup to remove recursion and duplicates

BEGIN;

-- 1. Drop Standard Policies (Fixes 'Already Exists' error)
DROP POLICY IF EXISTS "policy_jobs_select" ON jobs;
DROP POLICY IF EXISTS "policy_jobs_insert" ON jobs;
DROP POLICY IF EXISTS "policy_jobs_update" ON jobs;
DROP POLICY IF EXISTS "policy_jobs_delete" ON jobs;

-- 2. Drop Legacy Schema Policies (from 20251212 and others)
DROP POLICY IF EXISTS "Posters can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Posters can update own jobs" ON jobs;
DROP POLICY IF EXISTS "Posters can delete own jobs" ON jobs;
DROP POLICY IF EXISTS "Delete own jobs" ON jobs;
DROP POLICY IF EXISTS "jobs_update_poster" ON jobs;
DROP POLICY IF EXISTS "View public/own jobs" ON jobs;
DROP POLICY IF EXISTS "Insert own jobs" ON jobs;
DROP POLICY IF EXISTS "Update own jobs" ON jobs;
DROP POLICY IF EXISTS "Enable read access for all users" ON jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON jobs;
DROP POLICY IF EXISTS "Anyone can view open jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view all jobs" ON jobs;
DROP POLICY IF EXISTS "Public jobs are viewable by everyone" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;

-- 3. Create Standardized Policies
-- READ: Everyone can see jobs (public)
CREATE POLICY "policy_jobs_select" 
ON jobs FOR SELECT 
USING (true);

-- INSERT: Authenticated users can create jobs (must set themselves as poster)
CREATE POLICY "policy_jobs_insert" 
ON jobs FOR INSERT 
WITH CHECK (auth.uid() = poster_id);

-- UPDATE: Only the poster can update their own job
CREATE POLICY "policy_jobs_update" 
ON jobs FOR UPDATE 
USING (auth.uid() = poster_id)
WITH CHECK (auth.uid() = poster_id);

-- DELETE: Only the poster can delete their own job
CREATE POLICY "policy_jobs_delete" 
ON jobs FOR DELETE 
USING (auth.uid() = poster_id);

COMMIT;
