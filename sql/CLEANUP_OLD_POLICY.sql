-- CLEANUP: Remove old conflicting policy
DROP POLICY IF EXISTS "policy_jobs_select" ON jobs;

-- Verify remaining policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'jobs' ORDER BY policyname;
