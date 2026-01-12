-- FIX MISSING COLUMNS
-- Address errors: "review_count does not exist" and "updated_at of notifications does not exist"

BEGIN;

-- 1. Profiles Table: Add review_count
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 2. Notifications Table: Add updated_at
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMIT;
