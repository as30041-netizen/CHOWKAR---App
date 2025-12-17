-- ========================================
-- DIAGNOSTIC: Check Auth Setup
-- ========================================
-- Run this to see what's wrong
-- ========================================

-- 1. Check if the trigger exists and its function
SELECT 
    'Trigger exists?' as check,
    COUNT(*) as count
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 2. Check the trigger function source code
SELECT 
    'Trigger function source' as check,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 3. Check RLS policies on profiles
SELECT 
    'RLS Policies' as check,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 4. Check profiles table structure
SELECT 
    'Profiles table columns' as check,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. Check for unique constraints on profiles
SELECT 
    'Unique constraints' as check,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
AND contype IN ('u', 'p');

-- 6. Check if RLS is enabled
SELECT 
    'RLS enabled?' as check,
    relname as table_name,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'profiles';

-- ========================================
-- EXPECTED RESULTS:
-- ========================================
-- Trigger exists: count = 1
-- Function should show NEW.id (not gen_random_uuid())
-- Should have 4 policies
-- RLS should be enabled (t)
-- ========================================
