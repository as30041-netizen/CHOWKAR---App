-- ========================================================
-- REMOVE BOOST AND HIGHLIGHT FEATURES
-- ========================================================
-- This script removes all boost and highlight functionality from the app
-- including database columns, RPC functions, and related dependencies
-- ========================================================

BEGIN;

-- 1. DROP RPC FUNCTIONS
-- Drop boost-related functions
DROP FUNCTION IF EXISTS boost_job(UUID);
DROP FUNCTION IF EXISTS clean_expired_boosts();

-- Drop highlight-related function
DROP FUNCTION IF EXISTS highlight_bid(UUID);

-- 2. REMOVE DATABASE COLUMNS
-- Remove boost columns from jobs table
ALTER TABLE public.jobs DROP COLUMN IF EXISTS is_boosted;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS boost_expiry;

-- Remove highlight column from bids table
ALTER TABLE public.bids DROP COLUMN IF EXISTS is_highlighted;

COMMIT;

-- ========================================================
-- VERIFICATION QUERIES (Run these to verify removal)
-- ========================================================
-- Check if boost columns are removed from jobs
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'jobs' AND column_name IN ('is_boosted', 'boost_expiry');

-- Check if highlight column is removed from bids
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'bids' AND column_name = 'is_highlighted';

-- Check if functions are removed
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('boost_job', 'clean_expired_boosts', 'highlight_bid');
