/*
  ============================================================
  DIAGNOSTIC MINIMALIST TRIGGER
  ============================================================
  This script is designed to ISOLATE the "User not found" error.
  It does ONLY the absolute minimum to create a profile.
  It also captures any errors into a dedicated log table.
  ============================================================
*/

BEGIN;

-- 1. Create a Panic Log table for silent errors
CREATE TABLE IF NOT EXISTS public.auth_panic_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clean up ALL potential conflicting triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_wallet ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created_diagnostic ON auth.users;

-- 3. Create a Naked Profile Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_minimal()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- We do the insert inside a nested block so we can log errors
  BEGIN
    INSERT INTO public.profiles (id, name, email, phone, location)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
      COALESCE(NEW.email, ''),
      COALESCE(NEW.phone, 'pending_' || NEW.id::text),
      'Not set'
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- If even the insert fails, log it to the panic table but DO NOT abort
    INSERT INTO public.auth_panic_logs (user_id, error_message)
    VALUES (NEW.id, 'MINIMAL_INSERT_FAILED: ' || SQLERRM);
  END;

  RETURN NEW;
END;
$$;

-- 4. Bind the minimalist trigger
CREATE TRIGGER on_auth_user_created_diagnostic
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_minimal();

COMMIT;

SELECT '✅ Diagnostic Trigger Applied' as status;
