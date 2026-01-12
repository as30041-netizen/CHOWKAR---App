
-- REMOVE ALL UNUSED "WALLET/BONUS" TRIGGERS
-- Since the app is completely free, we do not need wallet balances or referral rewards.

BEGIN;

-- 1. Drop Referral Reward Trigger & Function
DROP TRIGGER IF EXISTS trigger_referral_reward ON public.profiles;
DROP FUNCTION IF EXISTS handle_referral_reward();

-- 2. Drop Welcome Bonus Trigger & Function (if it exists)
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP FUNCTION IF EXISTS handle_welcome_bonus();

-- 3. Drop Referral Code Generation (Optional: You might keep this if you want "Invite Friends" feature later, but safe to drop if unused)
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
DROP FUNCTION IF EXISTS generate_referral_code();

-- 4. Clean up Columns (Optional but cleaner)
-- If you want to really clean up the DB schema
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS wallet_balance;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS referral_code;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS referred_by;

COMMIT;
