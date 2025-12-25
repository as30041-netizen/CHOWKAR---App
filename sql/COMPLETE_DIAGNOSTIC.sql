
-- ==========================================================
-- COMPLETE DIAGNOSTIC & NUCLEAR RESET
-- ==========================================================
-- This script will:
-- 1. Show ALL triggers on profiles table
-- 2. DROP EVERYTHING
-- 3. Test a raw update
-- ==========================================================

-- STEP 1: DIAGNOSTIC - Show all triggers (RUN THIS FIRST, CHECK OUTPUT)
SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing,
    action_statement 
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
ORDER BY trigger_name;

-- STEP 2: NUCLEAR DROP - Remove ALL triggers from profiles
-- (Run this separately after checking the diagnostic output)
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP TRIGGER IF EXISTS trigger_referral_reward_insert ON public.profiles;
DROP TRIGGER IF EXISTS trigger_referral_reward_update ON public.profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP TRIGGER IF EXISTS aa_simple_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS simple_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trigger_update_user_rating ON public.profiles;
DROP TRIGGER IF EXISTS tr_profile_notification ON public.profiles;

-- STEP 3: TEST RAW UPDATE (Replace the UUID with your actual user ID)
-- This tests if the DB can update at all without hanging
-- You can find your user ID in the browser console log when you try to save.
-- Example: UPDATE public.profiles SET name = 'Test' WHERE id = 'f46b56be-4dd1-461e-8b51-b4f72a96ab4b';

-- STEP 4: VERIFY NO TRIGGERS LEFT
SELECT 
    trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- Expected output: NO ROWS (empty result)
