
-- ==========================================================
-- EMERGENCY BANDWIDTH & PERFORMANCE FIX (V4)
-- ==========================================================
-- This script:
-- 1. Removes 'profiles' from Realtime to stop the egress spike.
-- 2. Atomic reset of all triggers to stop the "Busy" error.
-- ==========================================================

BEGIN;

-- 1. STOP REALTIME FOR PROFILES (Fix for 9GB Egress)
-- This prevents big base64 images from being broadcasted to all users.
ALTER PUBLICATION supabase_realtime DROP TABLE profiles;

-- 2. CLEAR ALL TRIGGER BLOCKERS ON PROFILES
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP TRIGGER IF EXISTS trigger_referral_reward_insert ON public.profiles;
DROP TRIGGER IF EXISTS trigger_referral_reward_update ON public.profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS simple_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS aa_simple_updated_at ON public.profiles;

-- 3. RESET REWARDS FUNCTION TO BE ULTRA-LIGHTWEIGHT
CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if there's actually something to do
    IF (TG_OP = 'UPDATE' AND NEW.referred_by IS NOT DISTINCT FROM OLD.referred_by) THEN
        RETURN NEW;
    END IF;

    -- Minimal logic
    IF NEW.referred_by IS NOT NULL AND (OLD.referred_by IS NULL OR TG_OP = 'INSERT') THEN
        UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + 50 WHERE id = NEW.referred_by;
        NEW.wallet_balance := COALESCE(NEW.wallet_balance, 0) + 20;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-ESTABLISH SINGLE TRIGGER
CREATE TRIGGER trigger_referral_reward
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_referral_reward();

COMMIT;
