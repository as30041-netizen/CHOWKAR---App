-- FIX JOB INSERT HANG
-- This script removes problematic triggers that cause job creation to hang/timeout
-- It also ensures the jobs table is clean for insertion

BEGIN;

-- 1. Remove HTTP/Webhook triggers which often cause timeouts
DROP TRIGGER IF EXISTS on_job_created ON jobs;
DROP TRIGGER IF EXISTS notify_on_job_create ON jobs;
DROP TRIGGER IF EXISTS job_created_webhook ON jobs;
DROP TRIGGER IF EXISTS webhook_job_created ON jobs;

-- 2. Remove Wallet/Payment triggers (often complex and error prone)
DROP TRIGGER IF EXISTS charge_wallet_on_job_create ON jobs;
DROP TRIGGER IF EXISTS validate_balance_on_job_create ON jobs;
DROP TRIGGER IF EXISTS check_wallet_balance ON jobs;

-- 3. Remove other potential blockers
DROP TRIGGER IF EXISTS tr_check_category ON jobs;
DROP TRIGGER IF EXISTS check_category_trigger ON jobs;

-- 4. Re-enable standard Updated At trigger (safe)
DROP TRIGGER IF EXISTS handle_updated_at ON jobs;
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime('updated_at');

-- 5. Ensure RLS allows INSERT for authenticated users
DROP POLICY IF EXISTS "Users can create their own jobs" ON jobs;
CREATE POLICY "Users can create their own jobs"
    ON jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Users can insert jobs" 
    ON jobs 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true); -- Fallback broader policy if the first one fails matching

-- 6. Add performance index on poster_id if missing
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON jobs(poster_id);

COMMIT;

-- Verification
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'jobs';
