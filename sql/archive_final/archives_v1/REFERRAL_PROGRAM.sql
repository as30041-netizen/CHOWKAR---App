-- ========================================================
-- REFERRAL PROGRAM & PROFILE VERIFICATION
-- ========================================================
-- This script implements:
-- 1. Referral Codes (Unique for every user)
-- 2. Referral Tracking (Who invited whom)
-- 3. Reward Logic (Referrer gets ₹50)
-- 4. Verification Badges (Trust system)
-- ========================================================

BEGIN;

-- 1. EXTEND PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- 2. FUNCTION TO GENERATE UNIQUE REFERRAL CODE
-- Example: USER_A1B2
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Only generate if it doesn't exist
  IF NEW.referral_code IS NULL THEN
    LOOP
      -- Generate a 6-character random alphanumeric code
      v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
      
      -- Check if it exists
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    NEW.referral_code := v_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code on profile creation
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
CREATE TRIGGER trigger_generate_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- 3. REFERRAL REWARD LOGIC
-- Supports both INSERT (if metadata passed) and UPDATE (redeemed later)
CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
  v_new_user_name TEXT;
  v_referrer_balance INTEGER;
BEGIN
  -- CHECK: Only proceed if referred_by is NEWLY set (was null, now not null)
  IF (TG_OP = 'INSERT' AND NEW.referred_by IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL) THEN
     
    -- Prevent self-referral
    IF NEW.referred_by = NEW.id THEN
      RAISE EXCEPTION 'You cannot refer yourself!';
    END IF;

    v_referrer_id := NEW.referred_by;
    v_new_user_name := COALESCE(NEW.name, 'A new user');

    -- 1. Credit Referrer Wallet (₹50)
    UPDATE public.profiles 
    SET wallet_balance = COALESCE(wallet_balance, 0) + 50 
    WHERE id = v_referrer_id;

    -- 2. Record Transaction for Referrer
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (v_referrer_id, 50, 'CREDIT', 'Referral Bonus: ' || v_new_user_name);

    -- 3. Notify Referrer
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      v_referrer_id,
      'SUCCESS',
      'Referral Reward! 💰',
      v_new_user_name || ' joined using your code. You earned ₹50!'
    );
    
    -- 4. OPTIONAL: Credit New User (Welcome Bonus adjustment or extra)
    -- Start them with ₹20 extra if referred? 
    -- (Assuming triggers are safe, we can update the NEW row directly on insert, 
    -- but for update we must issue a separate update command? No, avoid recursion.)
    -- Let's just create a transaction for the new user effectively "Adding" money.
    -- Since this is an AFTER trigger, we must update the table again or use a BEFORE trigger to modify NEW.balance.
    -- For simplicity, we just issue an update for the new user to give them +₹20.
    
    UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + 20
    WHERE id = NEW.id;
    
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (NEW.id, 20, 'CREDIT', 'Referral Bonus (Joined via Code)');
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to apply reward on AFTER INSERT OR UPDATE
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
CREATE TRIGGER trigger_referral_reward
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_referral_reward();

-- 4. INITIALIZE CODES FOR EXISTING USERS
-- This loop generates codes for everyone who doesn't have one
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    LOOP
      v_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    UPDATE public.profiles SET referral_code = v_code WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;
