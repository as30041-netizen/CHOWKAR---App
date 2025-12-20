-- ========================================
-- CHOWKAR App - Supabase RLS Policies Fix
-- ========================================
-- Run this in Supabase SQL Editor to ensure
-- proper RLS policies for Google Sign-In
-- ========================================
-- Compatible with Supabase PostgreSQL
-- ========================================

-- Step 1: Drop existing policies (safe to run multiple times)
-- ========================================

DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view other profiles for jobs" ON profiles;
DROP POLICY IF EXISTS "Allow users to view other profiles" ON profiles;

-- Step 2: Enable RLS on profiles table
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create new policies
-- ========================================

-- Allow authenticated users to create their own profile
CREATE POLICY "Users can create own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to view other profiles (needed for job listings to show worker/poster info)
CREATE POLICY "Users can view other profiles for jobs"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Step 4: Verify policies are created
-- ========================================

SELECT 
    policyname,
    cmd,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_status,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_status
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ========================================
-- Expected Output:
-- ========================================
-- You should see 4 policies:
-- 1. "Users can create own profile" - INSERT
-- 2. "Users can view own profile" - SELECT
-- 3. "Users can update own profile" - UPDATE
-- 4. "Users can view other profiles for jobs" - SELECT
-- ========================================

-- ========================================
-- NOTES:
-- ========================================
-- ✅ Policies allow authenticated users to manage their own profiles
-- ✅ The "view other profiles" policy is CRITICAL for job functionality
--    (allows displaying worker/poster information in job listings and bids)
-- ✅ Safe to run this script multiple times (it drops before creating)
-- ========================================
