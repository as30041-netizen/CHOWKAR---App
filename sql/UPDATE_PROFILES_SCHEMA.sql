-- Fix Profiles Schema to match Code Expectations

BEGIN;

-- 1. Add missing columns expected by authService.ts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Relax Phone Constraint (for Google Auth which provides no phone)
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
-- Drop unique constraint if it exists (standard name usually profiles_phone_key)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

COMMIT;
