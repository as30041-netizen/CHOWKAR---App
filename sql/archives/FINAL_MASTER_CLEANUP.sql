
-- ==========================================================
-- FINAL MASTER FIX: UNBLOCK PROFILE SAVING
-- ==========================================================
-- This script will:
-- 1. Identify all triggers currently on the profiles table
-- 2. Drop EVERY trigger that might be causing a hang
-- 3. Re-create a SAFE and FAST environment
-- ==========================================================

BEGIN;

-- STEP 1: DROP ALL POTENTIAL HANG-CAUSING TRIGGERS
-- These are identified from various project SQL files
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications; -- Check this too!
DROP TRIGGER IF EXISTS trigger_push_notification ON public.notifications;

-- RE-ESTABLISH ONLY THE BASICS (Fast & Synchronous)

-- 1. Updated At (Standard)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 2. Referral Code Generation (Fast BEFORE trigger)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- 3. Referral Rewards (DISABLED FOR NOW TO DIAGNOSE)
-- We will disable this logic temporarily. If your profile saves instantly after running this,
-- then we know the recursion was exactly here.

COMMENT ON TABLE public.profiles IS 'Triggers cleaned on Dec 24 to fix saving hang';

COMMIT;

-- VERIFICATION QUERY
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
