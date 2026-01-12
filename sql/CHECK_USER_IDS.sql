-- ============================================
-- SIMPLE USER ID CHECK
-- ============================================
-- Verify which user IDs actually exist in profiles
-- ============================================

SELECT id, name, email FROM profiles 
WHERE id IN (
    'e266fa3d-d854-4445-be8b-cd054a2fa859',
    '69c95415-770e-4da4-8bf8-25084ace911b',
    '5e59b991-8f54-4547-a6f7-852c35363400',
    'fd926467-d454-4b9f-b2e4-183e10aae717',
    'a8adce52-3e5d-4e4b-aaad-75dab83c636c'
);

-- Check for any issues with the profiles table
SELECT COUNT(*) as total_users FROM profiles;
