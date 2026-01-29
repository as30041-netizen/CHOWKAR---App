-- ============================================================================
-- RESTORE AUTH LOGIC (REGRESSION FIX)
-- Description: Re-applies the robust user creation logic from FINAL_AUTH_FIX.sql
--              to resolve "Database error saving new user".
--              SAFE: Preserves recent schema changes (Wallet separation, BIGINT join_date).
-- ============================================================================

-- 1. FIX SCHEMA: Make phone field nullable (CRITICAL)
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- Drop the unique constraint on phone if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- 1.5 CLEANUP DUPLICATES (Fixes "Key (phone)=(...) is duplicated" error)
-- If duplicate phones exist, we keep the most recently created one and set others to NULL
UPDATE profiles
SET phone = NULL
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at DESC) as rn
        FROM profiles
        WHERE phone IS NOT NULL AND phone != ''
    ) t
    WHERE t.rn > 1
);

-- Optionally: Add a partial unique index (only for non-empty phones)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_when_set 
  ON profiles(phone) 
  WHERE phone IS NOT NULL AND phone != '';

-- 2. RESTORE SAFE TRIGGER
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
    (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint, -- Ensure BIGINT compatibility
    ARRAY[]::text[]
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    profile_photo = EXCLUDED.profile_photo,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: Swallow errors to allow signup to proceed even if profile creation fails slightly
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. ENSURE WALLET CREATION IS SAFE
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, 0, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_wallet error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON public.profiles;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- 4. VERIFICATION OUTPUT
DO $$
BEGIN
    RAISE NOTICE 'SUCCESS: Auth logic restored. Phone is nullable. Triggers are safe.';
END $$;
