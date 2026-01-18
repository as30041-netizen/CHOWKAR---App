-- ============================================================================
-- CHOWKAR STABILITY FIXES DEPLOYMENT
-- Date: 2026-01-16
-- Description: Consolidates Wallet Triggers and Notification RLS fixes.
-- ============================================================================

BEGIN;

-- Part 1: Auto-Create Wallets
-- ----------------------------------------------------------------------------
-- 1. Create the function that inserts a 0-balance wallet
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
    VALUES (NEW.id, 0, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the profiles table
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON public.profiles;
CREATE TRIGGER on_auth_user_created_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- 3. Backfill: Ensure all existing profiles have a wallet
INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
SELECT id, 0, NOW(), NOW() FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;


-- Part 2: Fix Notifications RLS (Realtime)
-- ----------------------------------------------------------------------------
-- 1. Ensure RLS is enabled
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- 2. Clean up old policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON "notifications";
DROP POLICY IF EXISTS "Users can update their own notifications" ON "notifications"; 
DROP POLICY IF EXISTS "Users can delete their own notifications" ON "notifications";
DROP POLICY IF EXISTS "Users can insert notifications" ON "notifications";

-- 3. Policy: VIEW
CREATE POLICY "Users can view their own notifications"
ON "notifications"
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Policy: UPDATE
CREATE POLICY "Users can update their own notifications"
ON "notifications"
FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Policy: DELETE
CREATE POLICY "Users can delete their own notifications"
ON "notifications"
FOR DELETE
USING (auth.uid() = user_id);

-- 6. Add to Realtime Publication (Critical for live alerts)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END
$$;

COMMIT;

-- Verify
SELECT count(*) as wallets_count FROM public.wallets;
