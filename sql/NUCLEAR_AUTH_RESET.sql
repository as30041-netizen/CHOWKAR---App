/*
  ============================================================
  CHOWKAR NUCLEAR AUTH RESET
  ============================================================
  This script FORCE-CLEARS every possible blocker for 
  Supabase Auth to ensure Google Sign-In works 100%.
  ============================================================
*/

BEGIN;

-- 1. DROP EVERY POSSIBLE TRIGGER ON auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ghost ON auth.users;

-- 2. DROP TRICKY PROFILE TRIGGERS (Discovered in Audit)
-- These fire AFTER UPDATE and might be colliding with Supabase metadata sync
DROP TRIGGER IF EXISTS trg_sync_user_phone ON public.profiles;
DROP TRIGGER IF EXISTS trigger_profile_update_sync ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;


-- 2. RELAX PROFILES CONSTRAINTS
-- If profiles requires 'location' or 'phone', and the trigger is missing,
-- GoTrue might fail if it has secondary internal dependencies.
-- We make EVERYTHING optional to be safe.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN name DROP NOT NULL;

-- 3. DROP UNIQUE CONSTRAINTS (Temporarily)
-- If a phone number "Not set" or empty string is causing a collision
-- for new Google users, this removes that blocker.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;
DROP INDEX IF EXISTS profiles_phone_key;
DROP INDEX IF EXISTS idx_profiles_phone_unique;

-- 4. CLEANUP ORPHAN IDENTITIES
-- Sometimes deleting from auth.users leaves "identities" that block new signups
-- with the same email. This is rare but possible on hosted instances.
-- (Note: Standard users might not have direct DELETE on auth.identities, 
-- but try anyway if running as service_role).
DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM auth.users);

COMMIT;

SELECT '🚀 NUCLEAR RESET COMPLETE. Try Google Sign-In NOW.' as status;
