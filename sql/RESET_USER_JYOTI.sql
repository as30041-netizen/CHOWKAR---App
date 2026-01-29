/*
  ============================================================
  RESET SPECIFIC USER SCRIPT
  ============================================================
  Surgically removes a user to allow a fresh "First Login" test.
  Target: jyotithakur40031@gmail.com
  ============================================================
*/

BEGIN;

-- 1. Identify User ID
DO $$
DECLARE
    target_id UUID;
BEGIN
    SELECT id INTO target_id FROM auth.users WHERE email = 'jyotithakur40031@gmail.com';

    IF target_id IS NOT NULL THEN
        -- 2. Delete from Public Schema (Cascades should handle it but we be explicit)
        DELETE FROM public.wallet_transactions WHERE wallet_id = target_id;
        DELETE FROM public.wallets WHERE user_id = target_id;
        DELETE FROM public.profiles WHERE id = target_id;
        
        -- 3. Delete from Auth Schema
        DELETE FROM auth.identities WHERE user_id = target_id;
        DELETE FROM auth.users WHERE id = target_id;
        
        RAISE NOTICE 'User jyotithakur40031@gmail.com has been completely reset. 🧹';
    ELSE
        RAISE NOTICE 'User not found. 🤷';
    END IF;
END $$;

COMMIT;

SELECT 'User reset complete. Redirect them to try login again.' as status;
