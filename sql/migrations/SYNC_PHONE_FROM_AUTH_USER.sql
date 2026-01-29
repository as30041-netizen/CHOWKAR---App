-- =====================================================
-- FIX: Sync Phone Number from auth.users for Phone Auth
-- This ensures users who sign in via Phone+OTP have their
-- number automatically saved to their profile, skipping
-- the onboarding phone step.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  u_name text;
  u_email text;
  u_phone text;
  u_avatar text;
BEGIN
  u_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  u_email := COALESCE(NEW.email, '');
  
  -- NEW: Extract phone from auth.users.phone (used by Phone+OTP auth)
  u_phone := NEW.phone;
  
  u_avatar := NEW.raw_user_meta_data->>'avatar_url';

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    email,
    phone,
    profile_photo,
    join_date,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    u_name,
    u_email,
    u_phone, -- Include the phone number
    u_avatar,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone = COALESCE(EXCLUDED.phone, profiles.phone), -- Don't overwrite existing phone
    profile_photo = COALESCE(EXCLUDED.profile_photo, profiles.profile_photo);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Also update existing Phone Auth users who might have null profiles.phone
UPDATE public.profiles p
SET phone = u.phone
FROM auth.users u
WHERE p.id = u.id
AND p.phone IS NULL
AND u.phone IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '✅ Phone sync trigger updated and backfill complete.';
END $$;
