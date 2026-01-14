-- ============================================================================
-- FIX: ALLOW PROFILE CREATION
-- The profiles table was missing an INSERT policy, preventing new user signups.
-- ============================================================================

BEGIN;

-- 1. Check if policy exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile" ON profiles
        FOR INSERT TO authenticated 
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;

COMMIT;
