-- Add UNIQUE constraint to the phone column in the profiles table
-- This prevents multiple accounts (e.g., Google and Phone) from sharing the same number.

DO $$ 
BEGIN
    -- 0. Relax NOT NULL constraints on dependent tables (bids and jobs)
    -- This is necessary because the trg_sync_user_phone trigger propagates NULLs
    -- from profiles to these tables, which previously had strict NOT NULL constraints.
    ALTER TABLE public.bids ALTER COLUMN worker_phone DROP NOT NULL;
    ALTER TABLE public.jobs ALTER COLUMN poster_phone DROP NOT NULL;

    -- 1. Handle existing "Not set" or empty strings: Convert to NULL
    -- Postgres UNIQUE constraints allow multiple NULLs, but not multiple empty strings.
    UPDATE public.profiles SET phone = NULL WHERE phone = '' OR phone = 'Not set';

    -- 2. Cull specific duplicate conflicts
    -- The user explicitly wants to keep phone numbers for as30041@gmail.com 
    -- and set others to NULL to resolve UNIQUE index conflicts.
    UPDATE public.profiles p
    SET phone = NULL
    WHERE p.phone IS NOT NULL
    AND p.email != 'as30041@gmail.com'
    AND EXISTS (
        SELECT 1 FROM public.profiles p2 
        WHERE p2.phone = p.phone 
        AND p2.email = 'as30041@gmail.com'
    );
    
    -- 3. Safety: Handle any OTHER duplicates (not involving as30041@gmail.com)
    -- If any other random duplicates exist, keep only the oldest entry and NULL the rest.
    -- This ensures the UNIQUE constraint below WILL NOT fail.
    UPDATE public.profiles p
    SET phone = NULL
    WHERE p.id IN (
        SELECT id FROM (
            SELECT id, row_number() OVER (PARTITION BY phone ORDER BY join_date ASC) as rn
            FROM public.profiles
            WHERE phone IS NOT NULL
        ) t WHERE rn > 1
    );

    -- 4. Add UNIQUE constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'profiles_phone_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
    END IF;
END $$;
