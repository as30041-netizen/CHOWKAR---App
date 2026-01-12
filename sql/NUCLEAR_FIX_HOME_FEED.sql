-- NUCLEAR: Drop ALL get_home_feed functions regardless of signature
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure as func_sig
        FROM pg_proc 
        WHERE proname = 'get_home_feed'
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.func_sig || ' CASCADE';
        RAISE NOTICE 'Dropped: %', func_record.func_sig;
    END LOOP;
END $$;

-- Now create the ONE correct version
CREATE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_status TEXT DEFAULT NULL,
    p_exclude_completed BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    job_date TEXT,
    duration TEXT,
    budget NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    accepted_bid_id UUID,
    image TEXT,
    bid_count BIGINT,
    my_bid_id UUID,
    my_bid_status TEXT,
    my_bid_amount NUMERIC,
    my_bid_last_negotiation_by TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        j.id,
        j.poster_id,
        COALESCE(j.poster_name, p.name, 'Unknown'),
        COALESCE(j.poster_photo, p.profile_photo),
        j.title,
        j.description,
        j.category,
        j.location,
        COALESCE(j.latitude, 0),
        COALESCE(j.longitude, 0),
        j.job_date,
        j.duration,
        j.budget,
        j.status,
        j.created_at,
        j.accepted_bid_id,
        j.image,
        (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id)::BIGINT,
        (SELECT b.id FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1),
        (SELECT b.status FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1),
        (SELECT b.amount FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1),
        (SELECT b.negotiation_history->-1->>'by' FROM bids b WHERE b.job_id = j.id AND b.worker_id = p_user_id LIMIT 1)
    FROM jobs j
    LEFT JOIN profiles p ON p.id = j.poster_id
    WHERE 
        (p_status IS NULL OR j.status = p_status)
        AND (p_exclude_completed = FALSE OR j.status != 'COMPLETED')
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_home_feed(UUID, INT, INT, TEXT, BOOLEAN) TO authenticated;

DO $$ BEGIN RAISE NOTICE '✅ All get_home_feed versions dropped and recreated'; END $$;
