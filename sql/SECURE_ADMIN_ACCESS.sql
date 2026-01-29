/*
  ============================================================
  ADMIN CONSOLE SECURITY (RLS)
  ============================================================
  This script creates a "Database Firewall" for your settings.
  Only as30041@gmail.com can CHANGE settings.
  Everyone else can only VIEW them.
  ============================================================
*/

BEGIN;

-- 1. Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.global_settings;
DROP POLICY IF EXISTS "Only Admin can update settings" ON public.global_settings;

-- 3. Create "Read-Only" Policy for Everyone
-- This is necessary so the app can fetch the Welcome Bonus for new users.
CREATE POLICY "Settings are viewable by everyone" 
ON public.global_settings 
FOR SELECT 
USING (true);

-- 4. Create "Master Admin" Policy
-- This uses the encrypted JWT email to verify identity on every write request.
CREATE POLICY "Only Admin can update settings" 
ON public.global_settings 
FOR ALL 
TO authenticated 
USING (auth.jwt() ->> 'email' = 'as30041@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'as30041@gmail.com');

COMMIT;

SELECT '🛡️ DATABASE FIREWALL ENABLED. Admin is locked to as30041@gmail.com' as status;
