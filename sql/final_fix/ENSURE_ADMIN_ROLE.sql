-- ENSURE_ADMIN_ROLE.sql
-- Purpose: Explicitly grant ADMIN role to 'as30041@gmail.com'
-- This ensures the RLS policy "role = 'ADMIN'" works for this specific user.

BEGIN;

-- 1. Update Profile based on Email (Linked via auth.users)
UPDATE public.profiles
SET role = 'ADMIN'
WHERE id IN (
    SELECT id 
    FROM auth.users 
    WHERE email = 'as30041@gmail.com'
);

-- 2. Verify (Optional logging)
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.profiles WHERE role = 'ADMIN';
    RAISE NOTICE 'Total Admins: %', v_count;
END $$;

COMMIT;
