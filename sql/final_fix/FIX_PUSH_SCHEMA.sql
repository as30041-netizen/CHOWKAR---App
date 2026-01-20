-- ============================================================================
-- FIX_PUSH_SCHEMA.sql
-- ============================================================================
-- The debug logs revealed that the 'profiles' table is missing the 'push_token' column.
-- This script adds the column so the Push Notification Trigger can find the token.
-- ============================================================================

-- 1. Add the missing column (Safe if exists)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Verify it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'push_token'
    ) THEN
        RAISE NOTICE '✅ SUCCESS: push_token column exists on profiles table.';
    ELSE
        RAISE EXCEPTION '❌ ERROR: Failed to create push_token column.';
    END IF;
END $$;
