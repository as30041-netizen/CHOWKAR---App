-- Fix Wallets RLS to resolve 406 error
-- Run this in Supabase SQL Editor

-- Step 1: Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.wallets;

-- Step 3: Create the correct policy
-- Note: user_id in wallets table stores the auth.uid() value
CREATE POLICY "Users can view own wallet" ON public.wallets
FOR SELECT 
TO authenticated
USING (auth.uid()::text = user_id::text);

-- Step 4: Also fix wallet_transactions while we're at it
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
FOR SELECT
TO authenticated
USING (auth.uid()::text = wallet_id::text);

-- Verification query (should return your policies)
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('wallets', 'wallet_transactions')
ORDER BY tablename, policyname;
