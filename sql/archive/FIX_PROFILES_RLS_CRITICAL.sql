-- ============================================
-- FIX PROFILES RLS POLICY (CRITICAL)
-- ============================================
-- The 401 error shows users can't read their own profile
-- This blocks the entire app from loading
-- ============================================

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- 2. Create simple, permissive SELECT policy
CREATE POLICY "authenticated_users_read_all_profiles" 
ON profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. Keep update policy restrictive (own profile only)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "users_update_own_profile" 
ON profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Verify RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Grant permissions
GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE ON profiles TO authenticated;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ profiles RLS policy fixed';
    RAISE NOTICE '   - All authenticated users can now read all profiles';
    RAISE NOTICE '   - Users can only update their own profile';
END $$;
