/*
  # Auto-create Profile on User Signup

  1. Changes
    - Creates a trigger function that automatically creates a profile when a new user signs up via auth
    - Sets up a trigger that fires after INSERT on auth.users
    - Extracts user data from raw_user_meta_data (name, email, avatar from OAuth)
    - Creates profile with default values and links to auth user

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only creates profile if one doesn't already exist
    - Uses data from authenticated OAuth provider
*/

-- Create function to handle new user profile creation
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
  -- Extract user data from OAuth metadata
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  user_email := COALESCE(NEW.email, '');
  user_avatar := NEW.raw_user_meta_data->>'avatar_url';

  -- Create profile for the new user
  INSERT INTO public.profiles (
    id,
    auth_user_id,
    name,
    email,
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
    gen_random_uuid(),
    NEW.id,
    user_name,
    user_email,
    'Not set',
    0,
    5.0,
    user_avatar,
    false,
    0,
    0,
    NOW(),
    ARRAY[]::text[]
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();