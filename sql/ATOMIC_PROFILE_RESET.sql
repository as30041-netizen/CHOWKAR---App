
-- ==========================================================
-- DIAGNOSTIC: LIST ALL TRIGGERS ON PROFILES
-- ==========================================================
-- This query will tell us exactly what is running on the profiles table.
-- ==========================================================

SELECT 
    trigger_name, 
    event_manipulation, 
    action_timing, 
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- ==========================================================
-- ATOMIC RESET: STRIP EVERYTHING NON-ESSENTIAL
-- ==========================================================

BEGIN;

-- Drop EVERY trigger we've ever mentioned or suspected
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP TRIGGER IF EXISTS trigger_referral_reward_insert ON public.profiles;
DROP TRIGGER IF EXISTS trigger_referral_reward_update ON public.profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;

-- Create only ONE ultra-simple trigger for updated_at
CREATE OR REPLACE FUNCTION simple_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aa_simple_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION simple_updated_at();

-- DELETE ANY PENDING QUITS/LOCKS (If possible)
-- Note: You can't actually 'kill' processes from SQL easily without superuser, 
-- but we can clear the path.

COMMIT;
