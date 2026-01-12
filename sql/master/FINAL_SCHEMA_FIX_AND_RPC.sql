-- CHECK SCHEMA STATUS
SELECT 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'jobs' 
    AND column_name IN ('poster_name', 'poster_photo', 'latitude', 'longitude', 'is_boosted', 'boost_expiry', 'job_type', 'views_count', 'bid_count');

-- Ensure missing columns are added with safety
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'poster_name') THEN
        ALTER TABLE jobs ADD COLUMN poster_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'poster_photo') THEN
        ALTER TABLE jobs ADD COLUMN poster_photo TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'latitude') THEN
        ALTER TABLE jobs ADD COLUMN latitude DOUBLE PRECISION DEFAULT 28.6139;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'longitude') THEN
        ALTER TABLE jobs ADD COLUMN longitude DOUBLE PRECISION DEFAULT 77.2090;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'is_boosted') THEN
        ALTER TABLE jobs ADD COLUMN is_boosted BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'boost_expiry') THEN
        ALTER TABLE jobs ADD COLUMN boost_expiry TIMESTAMPTZ;
    END IF;
END $$;

-- Fix the RPC to be more robust
CREATE OR REPLACE FUNCTION get_home_feed(
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
        COALESCE(j.poster_name, 'Unknown Poster'),
        j.poster_photo,
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
    WHERE 
        (p_status IS NULL OR j.status = p_status)
        AND (p_exclude_completed = FALSE OR j.status != 'COMPLETED')
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;
