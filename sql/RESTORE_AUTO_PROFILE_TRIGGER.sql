
-- RESTORE CRITICAL AUTO-PROFILE TRIGGER
-- This ensures that every time a user signs up (Google/Email), 
-- a profile row is created automatically in the 'profiles' table.

BEGIN;

-- 1. Create/Update the handle_new_user function
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
BEGIN
  -- Extract user data from metadata
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );
  
  user_email := COALESCE(NEW.email, '');
  user_avatar := NEW.raw_user_meta_data->>'avatar_url';

  -- Create profile row
  -- IF IT ALREADY EXISTS, we ONLY update name/email/photo, 
  -- and PRESERVE bio, phone, skills etc.
  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    email,
    profile_photo,
    join_date
  ) VALUES (
    NEW.id,
    NEW.id,
    user_name,
    user_email,
    user_avatar,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    profile_photo = EXCLUDED.profile_photo,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;

-- VERIFY
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
