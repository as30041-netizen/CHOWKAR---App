/*
  # Add Google OAuth Support to CHOWKAR

  ## Overview
  Migrates the authentication system from phone-based to Google OAuth while maintaining backward compatibility.

  ## Changes Made

  ### 1. Profile Table Schema Updates
  - **Added Column**: `email` (TEXT) - Primary identifier for Google OAuth users
  - **Modified Column**: `phone` - Now optional (removed NOT NULL constraint)
  - **Added Column**: `auth_user_id` (UUID) - Links to Supabase Auth users table
  - **Added Indexes**:
    - Unique index on `email` for fast lookups
    - Unique index on `auth_user_id` to ensure one-to-one relationship

  ### 2. Auto-Profile Creation
  - **Function**: `handle_new_user()` - Automatically creates a profile when a user signs up via Google OAuth
  - **Trigger**: `on_auth_user_created` - Executes the function on every new auth.users insert
  - **Default Values**:
    - Email from auth.users.email
    - Name from auth metadata or email prefix
    - Phone from metadata or empty string (optional)
    - Location default: "Not set"
    - Wallet balance: 100 (welcome bonus)
    - Rating: 5.0
    - Premium status: false

  ### 3. Security Updates (RLS Policies)
  - **Replaced**: Old policies using direct ID comparison
  - **New Policies**: Use `auth.uid()` and `auth_user_id` for proper authentication
  - **Policies Updated**:
    - "Users can view all profiles" - No change (SELECT)
    - "Users can update own profile" - Uses auth_user_id (UPDATE)
    - "Users can insert own profile" - Uses auth_user_id (INSERT)

  ## Important Notes
  1. **Backward Compatibility**: Existing phone-based users remain functional
  2. **Email Required**: Google OAuth users will have email as primary identifier
  3. **Phone Optional**: New users may not have phone numbers
  4. **Auto Welcome Bonus**: New users automatically receive 100 rupees
  5. **Security**: All policies enforce proper user ownership checks
*/

-- =====================================================
-- 1. ADD EMAIL COLUMN AND MAKE PHONE OPTIONAL
-- =====================================================

-- Add email column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Make phone optional by dropping NOT NULL constraint
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON profiles(email) WHERE email IS NOT NULL;

-- =====================================================
-- 2. ADD AUTH_USER_ID COLUMN FOR SUPABASE AUTH LINK
-- =====================================================

-- Add auth_user_id column to link with Supabase Auth
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN auth_user_id UUID;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_auth_user_id_fkey'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user_id_fkey 
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique index on auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_user_id_key ON profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- =====================================================
-- 3. CREATE AUTO-PROFILE CREATION FUNCTION
-- =====================================================

-- Function to create profile automatically on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile for new user
  INSERT INTO public.profiles (
    id,
    auth_user_id,
    email,
    name,
    phone,
    location,
    wallet_balance,
    rating,
    is_premium,
    ai_usage_count,
    jobs_completed
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'location', 'Not set'),
    100,
    5.0,
    false,
    0,
    0
  );

  -- Create welcome transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description
  )
  VALUES (
    NEW.id,
    100,
    'CREDIT',
    'Welcome Bonus'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. CREATE TRIGGER FOR AUTO-PROFILE CREATION
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 5. UPDATE RLS POLICIES
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new policies using auth.uid() and auth_user_id
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id OR auth.uid() = id)
  WITH CHECK (auth.uid() = auth_user_id OR auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id OR auth.uid() = id);

-- =====================================================
-- 6. ADD INDEX FOR EMAIL LOOKUPS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;