-- ============================================================================
-- CHOWKAR ADVANCED OPTIMIZATIONS & MAINTENANCE
-- Performance Tuning, Search Indexing, and Expiry Logic
-- ============================================================================

-- 1. PERFORMANCE INDEXES
-- Speed up feed filtering and chat message retrieval
CREATE INDEX IF NOT EXISTS idx_jobs_status_poster ON jobs(status, poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_bids_job_worker ON bids(job_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_job_created ON chat_messages(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_blocks_both ON user_blocks(blocker_id, blocked_id);

-- 2. FULL TEXT SEARCH OPTIMIZATION
-- Enables ultra-fast semantic search on jobs
-- Requires pg_trgm extension for ILIKE optimization or GIN for tsvector
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_jobs_search_trgm ON jobs USING gin (title gin_trgm_ops, description gin_trgm_ops);

-- 3. AUTOMATED JOB EXPIRY
-- Function to close jobs that are past their date
CREATE OR REPLACE FUNCTION close_expired_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE jobs
    SET status = 'CANCELLED', -- Or create an 'EXPIRED' status
        updated_at = NOW()
    WHERE status = 'OPEN'
      AND job_date < CURRENT_DATE;
      
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 4. UPDATE GET_HOME_FEED WITH USER BLOCKING
-- Ensure workers don't see jobs from posters they've blocked
CREATE OR REPLACE FUNCTION get_home_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    poster_id UUID,
    poster_name TEXT,
    poster_photo TEXT,
    poster_phone TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    job_date DATE,
    duration TEXT,
    budget INTEGER,
    status TEXT,
    image TEXT,
    created_at TIMESTAMPTZ,
    bid_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.poster_id,
        p.name AS poster_name,
        p.profile_photo AS poster_photo,
        p.phone AS poster_phone,
        j.title,
        j.description,
        j.category,
        j.location,
        j.latitude,
        j.longitude,
        j.job_date,
        j.duration,
        j.budget,
        j.status::TEXT,
        j.image,
        j.created_at,
        COALESCE((SELECT COUNT(*)::INTEGER FROM bids b2 WHERE b2.job_id = j.id), 0) AS bid_count
    FROM jobs j
    JOIN profiles p ON j.poster_id = p.id
    LEFT JOIN user_job_visibility ujv ON ujv.job_id = j.id AND ujv.user_id = p_user_id
    WHERE 
        j.status = 'OPEN'
        AND j.job_date >= CURRENT_DATE -- Auto-filter expired jobs in view
        AND j.poster_id != p_user_id
        -- Blocked Users check
        AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub 
            WHERE (ub.blocker_id = p_user_id AND ub.blocked_id = j.poster_id)
               OR (ub.blocker_id = j.poster_id AND ub.blocked_id = p_user_id)
        )
        -- Already bid check
        AND NOT EXISTS (
            SELECT 1 FROM bids b 
            WHERE b.job_id = j.id 
            AND b.worker_id = p_user_id
        )
        AND (ujv.is_hidden IS NULL OR ujv.is_hidden = FALSE)
        AND (p_category IS NULL OR p_category = '' OR j.category = p_category)
        AND (p_search_query IS NULL OR p_search_query = '' OR (
            j.title ILIKE '%' || p_search_query || '%' OR 
            j.description ILIKE '%' || p_search_query || '%'
        ))
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 5. ANALYTICS: AI USAGE TRACKING
-- Table to store when AI is used (PostJob, BidModal, Chat)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    feature TEXT NOT NULL, -- 'POST_JOB', 'BID_ENHANCEMENT', 'CHAT_TRANSLATION'
    input_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_logs(user_id, created_at);

-- RPC to log usage from frontend
CREATE OR REPLACE FUNCTION log_ai_usage(p_feature TEXT, p_tokens INTEGER DEFAULT 0)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ai_usage_logs (user_id, feature, input_tokens)
    VALUES (auth.uid(), p_feature, p_tokens);
    
    -- Update profile usage counter
    UPDATE profiles 
    SET ai_usage_count = COALESCE(ai_usage_count, 0) + 1
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PERMISSIONS
GRANT EXECUTE ON FUNCTION close_expired_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION log_ai_usage(TEXT, INTEGER) TO authenticated;
GRANT ALL ON ai_usage_logs TO authenticated;

-- 7. MARKET ANALYTICS (Required for Analytics Page)
CREATE OR REPLACE FUNCTION get_market_analytics()
RETURNS TABLE (
    total_jobs BIGINT,
    total_completed BIGINT,
    total_hidden BIGINT,
    market_cap_completed BIGINT,
    total_bids BIGINT,
    avg_bids_per_job NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM jobs) as total_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'COMPLETED') as total_completed,
        (SELECT COUNT(*) FROM user_job_visibility WHERE is_hidden = TRUE) as total_hidden,
        COALESCE((SELECT SUM(budget)::BIGINT FROM jobs WHERE status = 'COMPLETED'), 0) as market_cap_completed,
        (SELECT COUNT(*) FROM bids) as total_bids,
        ROUND((SELECT COUNT(*)::NUMERIC / GREATEST(COUNT(DISTINCT job_id), 1) FROM bids), 1) as avg_bids_per_job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_category_trends()
RETURNS TABLE (
    category TEXT,
    job_count BIGINT,
    avg_budget NUMERIC,
    completion_rate NUMERIC,
    withdrawal_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.category,
        COUNT(*)::BIGINT as job_count,
        ROUND(AVG(j.budget), 0) as avg_budget,
        ROUND((COUNT(*) FILTER (WHERE j.status = 'COMPLETED')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1) as completion_rate,
        ROUND((SELECT COUNT(*)::NUMERIC FROM bids b WHERE b.job_id IN (SELECT id FROM jobs j2 WHERE j2.category = j.category) AND b.status = 'REJECTED')::NUMERIC / GREATEST((SELECT COUNT(*)::NUMERIC FROM bids b2 WHERE b2.job_id IN (SELECT id FROM jobs j3 WHERE j3.category = j.category)), 1) * 100, 1) as withdrawal_rate
    FROM jobs j
    GROUP BY j.category
    ORDER BY job_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_market_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_trends() TO authenticated;

SELECT 'ADVANCED OPTIMIZATIONS COMPLETE ✅' AS status;
