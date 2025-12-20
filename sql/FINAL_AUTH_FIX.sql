-- ========================================
-- FINAL FIX: Make phone field nullable
-- ========================================
-- The issue: phone is NOT NULL UNIQUE, but we set it to ''
-- Multiple users with phone='' violates UNIQUE constraint!
-- ========================================

-- Step 1: Make phone field nullable and remove UNIQUE constraint
ALTER TABLE profiles 
  ALTER COLUMN phone DROP NOT NULL;

-- Drop the unique constraint on phone
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- Optionally: Add a partial unique index (only for non-empty phones)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_when_set 
  ON profiles(phone) 
  WHERE phone IS NOT NULL AND phone != '';

-- Step 2: Update the trigger to handle phone properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

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
  user_phone := NEW.raw_user_meta_data->>'phone';  -- Try to get phone from OAuth

  -- Create profile for the new user
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
    skills
  ) VALUES (
    NEW.id,
    NEW.id,
    user_name,
    user_email,
    user_phone,          -- NULL if not provided
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

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Add auth_user_id column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    UPDATE profiles SET auth_user_id = id WHERE auth_user_id IS NULL;
  END IF;
END $$;

-- Step 4: Update RLS policies (clean slate)
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view other profiles for jobs" ON profiles;
DROP POLICY IF EXISTS "Allow users to view other profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow service role full access (for trigger)
CREATE POLICY "Service role has full access"
ON profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 5: Verify setup
SELECT 
    'Setup complete!' as status,
    'Trigger' as component,
    COUNT(*) as count
FROM pg_trigger
WHERE tgname = 'on_auth_user_created'
UNION ALL
SELECT 
    'Setup complete!' as status,
    'Policies' as component,
    COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'profiles';

-- ========================================
-- WHAT THIS FIXES:
-- ========================================
-- ✅ Phone is now NULLABLE (can be NULL or empty)
-- ✅ Only non-empty phones must be unique
-- ✅ Multiple OAuth users can sign up without phone
-- ✅ Trigger sets phone to NULL if not provided
-- ✅ No more "Database error saving new user"!
-- ========================================
