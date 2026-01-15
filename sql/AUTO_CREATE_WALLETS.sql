-- Add trigger to automatically create a wallet for every new profile
BEGIN;

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

-- 3. Ensure all existing profiles have a wallet (Backfill)
INSERT INTO public.wallets (user_id, balance, created_at, updated_at)
SELECT id, 0, NOW(), NOW() FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
