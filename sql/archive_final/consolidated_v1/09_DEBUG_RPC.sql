-- DIAGNOSTIC RPC
-- Run this to check exactly WHY RLS might be hiding bids

CREATE OR REPLACE FUNCTION debug_job_visibility(p_job_id UUID)
RETURNS TABLE (
    check_name TEXT,
    result_text TEXT,
    result_uuid UUID,
    result_bool BOOLEAN
)
LANGUAGE plpgsql security definer
SET search_path = public
AS $$
DECLARE
    v_poster_id UUID;
    v_user_id UUID := auth.uid();
    v_bid_count INTEGER;
BEGIN
    -- 1. Check who is calling
    RETURN QUERY SELECT 'Caller ID (auth.uid)', 'User', v_user_id, NULL::BOOLEAN;

    -- 2. Check Job Poster
    SELECT poster_id INTO v_poster_id FROM jobs WHERE id = p_job_id;
    RETURN QUERY SELECT 'Job Poster ID', 'Job', v_poster_id, (v_poster_id = v_user_id);

    -- 3. Check Bids Count (No RLS - raw table count)
    SELECT count(*)::INTEGER INTO v_bid_count FROM bids WHERE job_id = p_job_id;
    RETURN QUERY SELECT 'Raw Bid Count', 'Table', NULL::UUID, (v_bid_count > 0);

    -- 4. Check RLS Visibility Test
    -- Does the EXISTS clause work?
    RETURN QUERY SELECT 'RLS Logic Test', 'EXISTS query', NULL::UUID, 
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = p_job_id 
        AND jobs.poster_id = v_user_id
    );
END;
$$;
