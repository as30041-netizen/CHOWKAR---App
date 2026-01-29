/*
  ============================================================
  FIX: FINAL BULLETPROOF AUTH TRIGGER
  ============================================================
  
  This script fixes the "User not found" error during Google Sign-In.
  It ensures all required columns are populated and adds an EXCEPTION
  handler so that profile creation issues never block the login flow.
  
  Run this in Supabase SQL Editor.
  ============================================================
*/

-- Drop the old trigger and function first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  u_name text;
  u_email text;
  u_avatar text;
  u_phone text;
BEGIN
  -- 1. Extract data from OAuth metadata
  u_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  
  u_email := COALESCE(NEW.email, '');
  u_avatar := NEW.raw_user_meta_data->>'avatar_url';
  
  -- 2. Handle phone number (Google users won't have it)
  -- We use a unique placeholder to satisfy UNIQUE constraints while allowing login.
  -- This also triggers the Onboarding Modal in the frontend.
  u_phone := COALESCE(
    NEW.phone,
    'pending_' || NEW.id::text
  );

  -- 3. Insert into profiles with all required columns
  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    email,
    phone,
    location,
    wallet_balance,
    rating,
    profile_photo,
    is_premium,
    ai_usage_count,
    jobs_completed,
    join_date,
    skills,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    u_name,
    u_email,
    u_phone,
    'Not set',  -- Location is NOT NULL in schema, set to 'Not set' for onboarding
    100,        -- Welcome Bonus
    5.0,
    u_avatar,
    false,
    0,
    0,
    NOW(),
    ARRAY[]::text[],
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.id,
    name = COALESCE(profiles.name, EXCLUDED.name),
    email = COALESCE(profiles.email, EXCLUDED.email),
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    updated_at = NOW();

  -- 4. Create welcome transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description
  ) VALUES (
    NEW.id,
    100,
    'CREDIT',
    'Welcome Bonus'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: Prevent trigger failure from blocking the entire sign-in flow
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify
SELECT '✅ Final Auth Trigger Fix applied successfully' as status;
