-- REMOVE WELCOME BONUS LOGIC
-- User Request: Remove everything related to welcome bonus.

-- 1. Remove from Admin Config (DB)
DELETE FROM global_settings WHERE key = 'welcome_bonus';

-- 2. Drop specific Welcome Bonus triggers (from previous grep)
DROP TRIGGER IF EXISTS trigger_welcome_bonus ON public.profiles;
DROP TRIGGER IF EXISTS tr_welcome_bonus ON public.profiles;
DROP FUNCTION IF EXISTS handle_new_user_welcome_bonus();

-- 3. Remove "Seen Bonus" column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_seen_welcome_bonus;

-- 4. Redefine handle_new_user to strictly exclude any transaction insertion
-- This overwrites any previous version that might have included the bonus logic.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, phone, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'WORKER'), -- Default role
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NOW()
  );
  
  -- NO TRANSACTION INSERTION HERE.
  -- Initial wallet balance defaults to 0 via table definition if not specified, 
  -- or we can explicitly set it if needed (but removing bonus implies 0).
  
  RETURN NEW;
END;
$$;

SELECT '✅ Welcome Bonus Logic Removed Successfully' as status;
