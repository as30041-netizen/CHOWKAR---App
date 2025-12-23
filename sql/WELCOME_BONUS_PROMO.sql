-- ========================================================
-- PROMOTIONAL OFFER: WELCOME BONUS ₹100
-- ========================================================
-- Requirement: 
-- 1. Give ₹100 free to all current users.
-- 2. Give ₹100 free to all new users joining before 9:00 AM, 17 June 2026.
-- ========================================================

BEGIN;

-- 1. Create (or Update) the function to apply bonus for NEW users
CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply if the current time is before the deadline: June 17, 2026, 9:00 AM IST
  -- Timezone +05:30 for Indian Standard Time
  IF NOW() < '2026-06-17 09:00:00+05:30' THEN
    -- Update the balance in the profiles table
    -- Since this is an AFTER trigger, we use a separate UPDATE statement
    UPDATE public.profiles 
    SET wallet_balance = COALESCE(wallet_balance, 0) + 100 
    WHERE id = NEW.id;
    
    -- Record the transaction in history
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (NEW.id, 100, 'CREDIT', 'Welcome Bonus ₹100');

    -- Send in-app notification
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.id,
      'SUCCESS',
      'CHOWKAR Gift 🎁',
      'Welcome to CHOWKAR! We have credited ₹100 to your wallet. You can use it to post jobs or connect with workers.'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the profiles table
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
CREATE TRIGGER trigger_welcome_bonus
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_welcome_bonus();

-- 3. Apply the bonus to all EXISTING users who haven't received it yet
-- This ensures the script is idempotent (can be run multiple times safely)

-- Update balances for existing users
UPDATE public.profiles
SET wallet_balance = COALESCE(wallet_balance, 0) + 100
WHERE id NOT IN (
    SELECT user_id FROM public.transactions 
    WHERE description = 'Welcome Bonus ₹100'
);

-- Log transactions and notifications for these existing users
INSERT INTO public.transactions (user_id, amount, type, description)
SELECT id, 100, 'CREDIT', 'Welcome Bonus ₹100'
FROM public.profiles
WHERE id NOT IN (
    SELECT user_id FROM public.transactions 
    WHERE description = 'Welcome Bonus ₹100'
);

INSERT INTO public.notifications (user_id, type, title, message)
SELECT id, 'SUCCESS', 'CHOWKAR Gift 🎁', 'Welcome to CHOWKAR! We have credited ₹100 to your wallet.'
FROM public.profiles p
WHERE id NOT IN (
    SELECT user_id FROM public.notifications 
    WHERE title = 'CHOWKAR Gift 🎁'
);

COMMIT;

-- Recommendation:
-- Using a Database Trigger (Trigger-based flow) is the best way to handle this promotion.
-- Why?
-- 1. Reliability: It works every time a user is created, regardless of whether they join via 
--    the mobile app, website, or an admin dashboard.
-- 2. Performance: It's processed inside the database server, making it extremely fast.
-- 3. Security: It cannot be bypassed by client-side hacks since it's hardcoded in the DB logic.
-- 4. Audit Trail: It automatically creates a transaction record, so users see the credit in their apps immediately.
