-- ========================================
-- COMPLETE AUTH FIX for CHOWKAR App
-- ========================================
-- This fixes the "Database error saving new user" issue
-- Run this entire script in Supabase SQL Editor
-- ========================================

-- Step 1: Drop and recreate the auto-profile trigger with correct ID mapping
-- ========================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function with CORRECT ID mapping
-- CRITICAL: id should be auth user id, NOT a random UUID!
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

  -- Create profile for the new user
  -- CRITICAL FIX: id = NEW.id (not gen_random_uuid())
  INSERT INTO public.profiles (
    id,                    -- THIS MUST BE auth user id!
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
    skills
  ) VALUES (
    NEW.id,               -- Use auth user id as profile id
    NEW.id,               -- Also store in auth_user_id for reference
    user_name,
    user_email,
    '',                   -- Empty phone initially
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
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    profile_photo = EXCLUDED.profile_photo,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create trigger that fires after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- Step 2: Fix RLS Policies
-- ========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view other profiles for jobs" ON profiles;
DROP POLICY IF EXISTS "Allow users to view other profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies that work with the trigger
-- The trigger runs as SECURITY DEFINER so it bypasses RLS
-- These policies are for normal user operations after profile is created

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to view other profiles (needed for job listings)
CREATE POLICY "Users can view other profiles for jobs"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Allow service role to do everything (for triggers)
CREATE POLICY "Service role has full access"
ON profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ========================================
-- Step 3: Verify setup
-- ========================================

SELECT 
    'Trigger Check' as check_type,
    tgname as name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

SELECT 
    'Policy Check' as check_type,
    policyname as name,
    cmd as command,
    roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ========================================
-- Step 4: Clean up any existing users with wrong IDs (optional)
-- ========================================

-- Uncomment this section if you have test users that were created with wrong IDs
-- WARNING: This will delete profiles that don't match auth users!

-- DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users);

-- ========================================
-- IMPORTANT NOTES:
-- ========================================
-- ✅ Trigger now uses auth user ID as profile ID (not random UUID)
-- ✅ This matches the RLS policy check: auth.uid() = id
-- ✅ Trigger runs with SECURITY DEFINER so it bypasses RLS
-- ✅ ON CONFLICT clause handles re-authentication
-- ✅ Service role policy allows trigger to work
-- ✅ Users can view their own and others' profiles (for job context)
-- ========================================

-- ========================================
-- Expected Result:
-- ========================================
-- After running this and testing Google Sign-In:
-- 1. User signs in with Google
-- 2. Trigger automatically creates profile with id = auth.uid()
-- 3. User can immediately access their profile
-- 4. No "Database error saving new user" error
-- ========================================
