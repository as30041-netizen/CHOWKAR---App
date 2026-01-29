-- ============================================================
-- UNIFIED WELCOME BONUS & PROFILE SYNC FIX
-- ============================================================
-- This script unifies the authentication trigger with the modern 
-- wallet schema and ensures the welcome bonus is credited reliably.

BEGIN;

-- 1. Ensure global_settings has the welcome_bonus key
INSERT INTO public.global_settings (key, value, description)
VALUES ('welcome_bonus', '50', 'Amount of coins given to new users')
ON CONFLICT (key) DO NOTHING;

-- 2. Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Create the robust Unified Trigger Function
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
BEGIN
  -- A. Fetch Welcome Bonus from Settings
  SELECT value::integer INTO v_welcome_bonus 
  FROM public.global_settings 
  WHERE key = 'welcome_bonus';
  
  v_welcome_bonus := COALESCE(v_welcome_bonus, 50);

  -- B. Extract data from OAuth metadata
  u_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  
  u_email := COALESCE(NEW.email, '');
  u_avatar := NEW.raw_user_meta_data->>'avatar_url';
  
  -- Use a unique placeholder for phone if missing (triggers onboarding)
  u_phone := COALESCE(
    NEW.phone,
    'pending_' || NEW.id::text
  );

  -- C. Create Profile
  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    email,
    phone,
    location,
    rating,
    profile_photo,
    is_premium,
    ai_usage_count,
    jobs_completed,
    join_date,
    skills,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    u_name,
    u_email,
    u_phone,
    'Not set',
    5.0,
    u_avatar,
    false,
    0,
    0,
    NOW(),
    ARRAY[]::text[],
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    auth_user_id = EXCLUDED.id,
    name = COALESCE(profiles.name, EXCLUDED.name),
    email = COALESCE(profiles.email, EXCLUDED.email),
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    updated_at = NOW();

  -- D. Create Wallet (Source of Truth for Balance)
  INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
  VALUES (NEW.id, v_welcome_bonus, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- E. Log Transaction (Correct table: wallet_transactions)
  INSERT INTO public.wallet_transactions (
    wallet_id, 
    amount, 
    transaction_type, 
    description,
    status,
    created_at
  ) VALUES (
    NEW.id, 
    v_welcome_bonus, 
    'BONUS',
    'Welcome Bonus', 
    'COMPLETED',
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Prevent trigger failure from blocking login
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Reattach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Fix RLS for Wallets (Allow owners to see and manage their wallets)
-- This ensures the UI can always see the balance.
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet" ON public.wallets
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage wallets" ON public.wallets;
CREATE POLICY "System can manage wallets" ON public.wallets
FOR ALL TO authenticated USING (auth.uid() = user_id);

COMMIT;

SELECT '✅ Unified Welcome Bonus & Sync Fix applied successfully' as status;
