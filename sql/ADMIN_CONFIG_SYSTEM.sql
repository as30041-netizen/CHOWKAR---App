/*
  ============================================================
  ADMIN CONFIGURATION SYSTEM
  ============================================================
  
  This script creates a central settings table where you can
  easily change the Welcome Bonus and Bid Amount.
  
  Run this in Supabase SQL Editor.
  ============================================================
*/

BEGIN;

-- 1. Create Settings Table
CREATE TABLE IF NOT EXISTS public.global_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert Default Settings
INSERT INTO public.global_settings (key, value, description)
VALUES 
    ('welcome_bonus', '100', 'Amount of coins given to new users'),
    ('bid_fee', '10', 'Amount of coins deducted per bid')
ON CONFLICT (key) DO UPDATE SET
    updated_at = NOW();

-- 3. Update the handle_new_user trigger to use these settings
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
  v_welcome_bonus integer;
  col_exists boolean;
BEGIN
  -- Get Welcome Bonus from Settings
  SELECT value::integer INTO v_welcome_bonus 
  FROM public.global_settings 
  WHERE key = 'welcome_bonus';
  
  v_welcome_bonus := COALESCE(v_welcome_bonus, 100);

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

  -- A. Create Profile
  INSERT INTO public.profiles (id, name, email, phone, location)
  VALUES (NEW.id, u_name, u_email, u_phone, 'Not set')
  ON CONFLICT (id) DO NOTHING;

  -- B. Update optional columns
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'auth_user_id') INTO col_exists;
  IF col_exists THEN
     UPDATE public.profiles SET auth_user_id = NEW.id WHERE id = NEW.id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'wallet_balance') INTO col_exists;
  IF col_exists THEN
     UPDATE public.profiles SET wallet_balance = v_welcome_bonus WHERE id = NEW.id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_photo') INTO col_exists;
  IF col_exists THEN
     UPDATE public.profiles SET profile_photo = u_avatar WHERE id = NEW.id;
  END IF;

  -- C. Create Wallet
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, v_welcome_bonus)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = GREATEST(wallets.balance, v_welcome_bonus);

  -- D. Log Transaction
  -- Check which transaction table name is correct (transactions or wallet_transactions)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions' AND table_schema = 'public') THEN
      INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, description)
      VALUES (NEW.id, v_welcome_bonus, 'BONUS', 'Welcome Bonus');
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions' AND table_schema = 'public') THEN
      INSERT INTO public.transactions (user_id, amount, type, description)
      VALUES (NEW.id, v_welcome_bonus, 'CREDIT', 'Welcome Bonus');
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMIT;

SELECT '✅ Admin Config System & Refined Trigger applied successfully' as status;
