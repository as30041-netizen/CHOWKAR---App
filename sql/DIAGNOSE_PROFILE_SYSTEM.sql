
-- 1. Check Profiles Schema (Columns & Types)
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- 2. Check RLS Policies on tables
SELECT 
    schemaname, tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('profiles', 'jobs', 'bids');

-- 3. Check for specific profile data integrity (replace UUID with specific user ID if known, otherwise list recent)
-- Using a limit to avoid massive output.
SELECT id, updated_at, phone, name FROM profiles ORDER BY updated_at DESC LIMIT 5;
