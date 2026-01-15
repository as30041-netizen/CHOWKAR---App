-- ============================================================================
-- STEP 1: Run this FIRST to drop ALL existing function versions
-- ============================================================================

-- Drop all get_home_feed variants
DO $$ 
DECLARE 
    func_signature TEXT;
BEGIN
    FOR func_signature IN 
        SELECT pg_get_functiondef(oid) 
        FROM pg_proc 
        WHERE proname = 'get_home_feed'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS get_home_feed CASCADE';
        EXIT; -- Exit after first successful drop
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- If name is ambiguous, drop by full signature from pg_proc
        FOR func_signature IN
            SELECT oid::regprocedure::text
            FROM pg_proc
            WHERE proname = 'get_home_feed'
        LOOP
            BEGIN
                EXECUTE 'DROP FUNCTION ' || func_signature || ' CASCADE';
            EXCEPTION
                WHEN OTHERS THEN
                    NULL; -- Continue to next
            END;
        END LOOP;
END $$;

-- Drop all get_job_bids variants  
DO $$ 
DECLARE 
    func_signature TEXT;
BEGIN
    FOR func_signature IN 
        SELECT pg_get_functiondef(oid) 
        FROM pg_proc 
        WHERE proname = 'get_job_bids'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS get_job_bids CASCADE';
        EXIT; -- Exit after first successful drop
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- If name is ambiguous, drop by full signature from pg_proc
        FOR func_signature IN
            SELECT oid::regprocedure::text
            FROM pg_proc
            WHERE proname = 'get_job_bids'
        LOOP
            BEGIN
                EXECUTE 'DROP FUNCTION ' || func_signature || ' CASCADE';
            EXCEPTION
                WHEN OTHERS THEN
                    NULL; -- Continue to next
            END;
        END LOOP;
END $$;

-- Drop all get_my_applications_feed variants
DO $$ 
DECLARE 
    func_signature TEXT;
BEGIN
    FOR func_signature IN 
        SELECT oid::regprocedure::text
        FROM pg_proc
        WHERE proname = 'get_my_applications_feed'
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION ' || func_signature || ' CASCADE';
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
    END LOOP;
END $$;

-- Confirm drops
SELECT 'All functions dropped successfully. Now run COMPLETE_FIX_ALL_ERRORS.sql' AS status;
