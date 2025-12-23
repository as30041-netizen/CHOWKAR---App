-- ========================================================
-- FIX FOR DUPLICATE WELCOME BONUS UI
-- ========================================================
-- Adds a flag to track if a user has already seen the 
-- welcome bonus celebration, ensuring it only shows once
-- across all devices.

BEGIN;

-- 1. Add the column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_seen_welcome_bonus BOOLEAN DEFAULT FALSE;

-- 2. Update existing users (optional, if they've received bonus they might have seen it already 
-- but we'll let them see it once more to be safe or set to TRUE if we assume they have)
-- For now, we'll leave it as FALSE for everyone so they see it one last time on their next login.

COMMIT;
