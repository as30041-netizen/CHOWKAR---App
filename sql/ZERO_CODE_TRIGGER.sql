/*
  ============================================================
  ZERO-CODE "THE GHOST" TRIGGER
  ============================================================
  This script does ABSOLUTELY NOTHING but return the user row.
  If this still fails, the problem is 100% in Supabase Auth config,
  domain redirects, or external provider settings.
  ============================================================
*/

BEGIN;

-- 1. Remove ALL previous triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_diagnostic ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_minimal ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ghost ON auth.users;

-- 2. Create a function that just says "Go ahead"
CREATE OR REPLACE FUNCTION public.handle_new_user_ghost()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- No profiling, no wallets, no transactions. Just returning.
  RETURN NEW;
END;
$$;

-- 3. Bind the ghost trigger
CREATE TRIGGER on_auth_user_created_ghost
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_ghost();

COMMIT;

SELECT '✅ Zero-Code Ghost Trigger Applied. Try Login Now.' as status;
