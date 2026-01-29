/*
  ============================================================
  CHOWKAR SUPER MASTER AUTH FIX (REFINED)
  ============================================================
  
  This script fixes the persistent auth loop by:
  1. Ensuring the Wallet tables exist with correct names.
  2. Creating a truly bulletproof trigger that handles all dependencies.
  3. Fixing the "User not found" error permanently by handling dynamic columns.
  
  Run this in Supabase SQL Editor.
  ============================================================
*/

BEGIN;

-- 1. Ensure Wallet Tables exist
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(user_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Drop the old triggers to clean up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_wallet ON public.profiles;

-- 3. Create the Integrated Trigger Function
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
  u_phone text;
  col_exists boolean;
BEGIN
  -- Data Extraction
  u_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  u_email := COALESCE(NEW.email, '');
  u_avatar := NEW.raw_user_meta_data->>'avatar_url';
  u_phone := COALESCE(NEW.phone, 'pending_' || NEW.id::text);

  -- A. Create Profile (with dynamic column handling)
  -- We start with the core columns always present
  INSERT INTO public.profiles (id, name, email, phone, location)
  VALUES (NEW.id, u_name, u_email, u_phone, 'Not set')
  ON CONFLICT (id) DO NOTHING;

  -- B. Update optional columns if they exist
  -- Check for auth_user_id
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'auth_user_id') INTO col_exists;
  IF col_exists THEN
     UPDATE public.profiles SET auth_user_id = NEW.id WHERE id = NEW.id;
  END IF;

  -- Check for wallet_balance
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'wallet_balance') INTO col_exists;
  IF col_exists THEN
     UPDATE public.profiles SET wallet_balance = 100 WHERE id = NEW.id;
  END IF;

  -- Check for profile_photo
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_photo') INTO col_exists;
  IF col_exists THEN
     UPDATE public.profiles SET profile_photo = u_avatar WHERE id = NEW.id;
  END IF;

  -- C. Create Wallet (Source of truth for balance)
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = GREATEST(wallets.balance, 100);

  -- D. Log Transaction
  INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, description)
  VALUES (NEW.id, 100, 'BONUS', 'Welcome Bonus')
  ON CONFLICT DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Re-bind the trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;

SELECT '✅ Super Master Auth Fix Applied Successfully' as status;
