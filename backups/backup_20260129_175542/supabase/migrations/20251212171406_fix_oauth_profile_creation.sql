/*
  # Fix OAuth Profile Creation Issue

  ## Problem
  The previous trigger function was trying to insert a random UUID as the profile ID,
  which violated the foreign key constraint (profiles.id REFERENCES auth.users.id).

  ## Solution
  Update the handle_new_user() function to use the auth user ID (NEW.id) as the 
  profile ID, which satisfies the foreign key constraint.

  ## Changes
  1. Modified handle_new_user() function to use NEW.id for profiles.id
  2. Fixed ON CONFLICT clause to use 'id' instead of 'auth_user_id'
  3. Added phone field with empty string default (required by schema)

  ## Security
  - Function runs with SECURITY DEFINER to bypass RLS during profile creation
  - Only creates profile if one doesn't already exist (ON CONFLICT DO NOTHING)
*/

-- Update the trigger function to use auth user ID as profile ID
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
    split_part(NEW.email, '@', 1)
  );
  
  user_email := COALESCE(NEW.email, '');
  user_avatar := NEW.raw_user_meta_data->>'avatar_url';
  user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- Create profile with auth user ID as the primary key
  INSERT INTO public.profiles (
    id,              -- Must match auth.users.id (foreign key constraint)
    auth_user_id,    -- Also set for backward compatibility
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
    NEW.id,          -- Use auth user ID (satisfies foreign key)
    NEW.id,          -- Same auth user ID
    user_name,
    user_email,
    user_phone,
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
  ON CONFLICT (id) DO NOTHING;  -- Use 'id' since that's the primary key

  RETURN NEW;
END;
$$;