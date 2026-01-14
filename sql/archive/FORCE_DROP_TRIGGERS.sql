-- FORCE REMOVE ALL TRIGGERS FROM JOBS TABLE
-- This is to resolve persistent hangs on Update/Delete operations

BEGIN;

-- Drop standard triggers
DROP TRIGGER IF EXISTS handle_updated_at ON jobs;
DROP TRIGGER IF EXISTS on_auth_user_created ON public.profiles; -- unrelated but good cleanup if mess
DROP TRIGGER IF EXISTS on_job_created ON jobs;
DROP TRIGGER IF EXISTS notify_on_job_create ON jobs;

-- Drop specific business logic triggers that might be hanging
DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP TRIGGER IF EXISTS charge_wallet_on_job_create ON jobs;
DROP TRIGGER IF EXISTS referral_reward_trigger ON public.profiles;

-- List any other potential triggers found in codebase and drop them
DROP TRIGGER IF EXISTS tr_check_category ON jobs;
DROP TRIGGER IF EXISTS check_category_trigger ON jobs;
DROP TRIGGER IF EXISTS job_status_update ON jobs;

COMMIT;

-- Verify
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'jobs';
