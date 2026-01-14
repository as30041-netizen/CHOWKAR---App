-- ============================================================================
-- 🪙 CHOWKAR WALLET SYSTEM (INIT)
-- ============================================================================

BEGIN;

-- 1. Create Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0), -- Prevent negative balance
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Transactions Log
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(user_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Negative for spend, Positive for buy/bonus
    type TEXT NOT NULL CHECK (type IN ('BONUS', 'PURCHASE', 'BID_FEE', 'REFUND', 'ADJUSTMENT')),
    description TEXT,
    reference_id UUID, -- Can link to job_id or payment_id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can see their OWN balance
CREATE POLICY "Users can view own wallet" ON public.wallets
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can see their OWN transactions
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
    FOR SELECT TO authenticated USING (wallet_id = auth.uid());

-- 4. Auto-Create Wallet Trigger (New Users)
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (NEW.id, 50); -- Give 50 Free Coins

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, description)
    VALUES (NEW.id, 50, 'BONUS', 'Welcome Bonus');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind to Profile Creation (or Auth Creation)
-- Assuming we stick to Profile creation as the main event
DROP TRIGGER IF EXISTS on_profile_created_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- 5. Backfill Existing Users (One-time migration)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM profiles WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = profiles.id) LOOP
        INSERT INTO wallets (user_id, balance) VALUES (r.id, 50);
        INSERT INTO wallet_transactions (wallet_id, amount, type, description) VALUES (r.id, 50, 'BONUS', 'Migration Bonus');
    END LOOP;
END $$;

COMMIT;
