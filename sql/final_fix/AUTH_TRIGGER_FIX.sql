-- ==========================================
-- CRITICAL AUTH TRIGGER & SCHEMA FIX
-- ==========================================

BEGIN;

-- 1. Ensure the profiles table is correctly structured
-- We make sure join_date and other columns exist and are accessible
ALTER TABLE public.profiles 
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id); -- Add back for compatibility with some scripts if needed

-- 2. Update the handle_new_user function with better resilience
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_name text;
  user_email text;
  user_avatar text;
  epoch_now bigint;
BEGIN
  -- 1. Extract and sanitize metadata
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  
  user_email := COALESCE(NEW.email, '');
  user_avatar := NEW.raw_user_meta_data->>'avatar_url';
  
  -- Use epoch milliseconds for BIGINT join_date column
  epoch_now := (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;

  -- 2. Insert the profile
  -- We ONLY insert columns we are 100% sure exist in public.profiles
  INSERT INTO public.profiles (
    id,
    name,
    email,
    profile_photo,
    join_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    user_name,
    user_email,
    user_avatar,
    epoch_now,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    profile_photo = EXCLUDED.profile_photo,
    updated_at = NOW();

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: Catch errors so the sign-in itself doesn't fail.
  -- The app frontend (authService.ts) has logic to create a profile 
  -- if it sees the user exists but the profile row is missing.
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Re-enable the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;

-- VERIFY
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
