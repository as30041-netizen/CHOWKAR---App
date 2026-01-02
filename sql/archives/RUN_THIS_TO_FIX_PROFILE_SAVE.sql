
-- ==========================================================
-- NUCLEAR FIX FOR PROFILE UPDATE HANGS & TRIGGER RECURSION
-- ==========================================================
-- This script safely drops ALL problematic triggers on 'profiles'
-- and re-establishes only the essential ones with recursion guards.
-- ==========================================================

BEGIN;

-- 1. DROP ALL POTENTIAL CONFLICTING TRIGGERS
-- We are dropping them by name to be safe.
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles; -- old one
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles; -- we'll recreate standard one

-- 2. ENSURE COLUMNS EXIST (Just in case)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- 3. RECREATE STANDARD 'updated_at' TRIGGER
-- This is safe and necessary.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- 4. FIX REFERRAL REWARD TRIGGER (Prevent Infinite Recursion)
-- We split the logic:
-- A. Code Generation (BEFORE INSERT) - Safe
-- B. Rewards (AFTER UPDATE) - Must have guard

-- 4A. CODE GENERATION
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    NEW.referral_code := v_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- 4B. REWARDS (with STRICT recursion guards)
CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
  v_new_user_name TEXT;
BEGIN
  -- GUARD 1: Only run if 'referred_by' actually CHANGED.
  -- This prevents the trigger from firing on wallet balance updates.
  IF (TG_OP = 'UPDATE' AND NEW.referred_by IS NOT DISTINCT FROM OLD.referred_by) THEN
    RETURN NEW;
  END IF;

  -- Logic:
  -- IF INSERTing with referred_by set
  -- OR UPDATEing from NULL to SET
  IF (TG_OP = 'INSERT' AND NEW.referred_by IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL) THEN
     
    IF NEW.referred_by = NEW.id THEN
       -- Soft fail or ignore self-referral
       RETURN NEW; 
    END IF;

    v_referrer_id := NEW.referred_by;
    v_new_user_name := COALESCE(NEW.name, 'A new user');

    -- 1. Credit REFERRER (Separate row, safeish)
    UPDATE public.profiles 
    SET wallet_balance = COALESCE(wallet_balance, 0) + 50 
    WHERE id = v_referrer_id;

    -- 2. Notify Referrer
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (v_referrer_id, 50, 'CREDIT', 'Referral Bonus: ' || v_new_user_name);

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_referrer_id,'SUCCESS','Referral Reward! 💰', v_new_user_name || ' joined using your code.');

    -- 3. Credit CURRENT USER (The tricky part)
    -- We cannot UPDATE the row we are in reliably in an AFTER trigger without causing recursion risk
    -- unless we are very careful.
    -- BUT, since we added the "referred_by CHANGED" guard at the top,
    -- updating wallet_balance (which doesn't change referred_by) will NOT re-trigger this logic!
    
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + 20
    WHERE id = NEW.id;
    
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (NEW.id, 20, 'CREDIT', 'Referral Bonus (Joined via Code)');
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_referral_reward
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_referral_reward();

COMMIT;
