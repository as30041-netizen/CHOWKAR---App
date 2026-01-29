/*
  ============================================================
  FIX: Auto Profile Creation Trigger for Google OAuth
  ============================================================
  
  Issue: The original trigger was missing the 'phone' field which is NOT NULL.
  This caused Google OAuth sign-ups to fail after database cleanup.
  
  Run this in Supabase SQL Editor to fix.
  ============================================================
*/

-- Drop the old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create updated function with phone field
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
  user_phone text;
BEGIN
  -- Extract user data from OAuth metadata
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  
  user_email := COALESCE(NEW.email, '');
  user_avatar := NEW.raw_user_meta_data->>'avatar_url';
  
  -- For phone auth, use the phone number. For OAuth, use a placeholder.
  -- The placeholder uses the user's UUID to ensure uniqueness.
  user_phone := COALESCE(
    NEW.phone,
    'pending_' || NEW.id::text
  );

  -- Create profile for the new user
  -- Using NEW.id directly as profile.id (not gen_random_uuid()) so it matches auth.users.id
  INSERT INTO public.profiles (
    id,
    name,
    phone,
    email,
    location,
    wallet_balance,
    rating,
    profile_photo,
    is_premium,
    ai_usage_count,
    jobs_completed,
    join_date,
    skills
  ) VALUES (
    NEW.id,  -- Profile ID = Auth User ID for 1:1 mapping
    user_name,
    user_phone,
    user_email,
    'Not set',
    0,
    5.0,
    user_avatar,
    false,
    0,
    0,
    NOW(),
    ARRAY[]::text[]
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Remove the old auth_user_id column constraint if it exists (cleanup)
-- This is safe to run multiple times
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_auth_user_id_key' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_auth_user_id_key;
  END IF;
END $$;

-- Verify the trigger is working
SELECT 'Trigger fix applied successfully!' AS status;
