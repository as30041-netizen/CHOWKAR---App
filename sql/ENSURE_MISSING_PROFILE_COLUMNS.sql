
BEGIN;

-- 1. Ensure 'bio' column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Ensure 'experience' column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS experience TEXT;

-- 3. Ensure 'skills' column exists and is array type
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- 4. Ensure 'verified' column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

COMMIT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('bio', 'experience', 'skills', 'verified');
