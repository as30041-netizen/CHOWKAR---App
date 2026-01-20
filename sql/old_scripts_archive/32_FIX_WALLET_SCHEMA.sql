
-- 32_FIX_WALLET_SCHEMA.sql
-- Fix: Add missing transaction_type column to wallet_transactions
-- Reason: RPCs fail because they expect this column, but the table was created without it.

BEGIN;

-- 1. Safely add the column if it's missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'wallet_transactions' AND column_name = 'transaction_type') THEN
        
        ALTER TABLE wallet_transactions 
        ADD COLUMN transaction_type TEXT DEFAULT 'ADJUSTMENT';
        
        -- Optional: specific backfill if 'type' column exists (legacy)
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'wallet_transactions' AND column_name = 'type') THEN
            UPDATE wallet_transactions 
            SET transaction_type = type 
            WHERE transaction_type IS NULL OR transaction_type = 'ADJUSTMENT';
        END IF;

        ALTER TABLE wallet_transactions ALTER COLUMN transaction_type SET NOT NULL;
    END IF;
END $$;

-- 2. Drop legacy 'type' column if we want to be clean (Optional, keeping for safety for now)
-- ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS type;

COMMIT;
