-- ========================================================
-- CHOWKAR: FINAL DATABASE STABILITY FIX (MAX FLEXIBILITY)
-- Fixes: Profile creation, Wallet creation, and RLS Permissions
-- ========================================================

BEGIN;

-- 1. ENSURE ENUMS EXIST
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('WORKER', 'POSTER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. FIX PROFILES TABLE SCHEMA (Drop strict constraints that block registration)
-- Ensure all columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'POSTER';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS jobs_completed INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS join_date BIGINT;

-- RELAX CONSTRAINTS: Allow nulls for everything except ID and Name
-- These often have legacy NOT NULL constraints that break new signups
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN bio DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN experience DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN profile_photo DROP NOT NULL;

-- 3. RESILIENT TYPE CONVERSION for join_date
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'join_date' 
          AND data_type = 'timestamp with time zone'
    ) THEN
        ALTER TABLE public.profiles ALTER COLUMN join_date DROP DEFAULT;
        ALTER TABLE public.profiles ALTER COLUMN join_date TYPE BIGINT USING (EXTRACT(EPOCH FROM join_date) * 1000)::BIGINT;
    END IF;
END $$;

-- 4. FIX RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 5. IMPROVED PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  u_name text;
  u_email text;
  u_avatar text;
BEGIN
  u_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  u_email := COALESCE(NEW.email, '');
  u_avatar := NEW.raw_user_meta_data->>'avatar_url';

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    email,
    profile_photo,
    join_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    u_name,
    u_email,
    u_avatar,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    profile_photo = EXCLUDED.profile_photo;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. IMPROVED WALLET CREATION TRIGGER
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

-- 7. ROBUST BACKFILL
INSERT INTO public.profiles (id, name, email, join_date)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'User'), 
    email, 
    (EXTRACT(EPOCH FROM created_at) * 1000)::bigint
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (user_id, balance)
SELECT id, 0 FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- VERIFY
SELECT table_name, column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name IN ('location', 'join_date', 'email');
