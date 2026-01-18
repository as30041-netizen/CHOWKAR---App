-- ============================================================================
-- GET MY APPLICATIONS FEED RPC
-- Consolidates Job, Bid, and Visibility data for Workers
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_applications_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(t) INTO v_result
    FROM (
        SELECT 
            j.*,
            p.name AS poster_name,
            p.profile_photo AS poster_photo,
            b.id AS my_bid_id,
            b.status AS my_bid_status,
            b.amount AS my_bid_amount,
            (b.negotiation_history->-1->>'by') AS my_bid_last_negotiation_by,
            (SELECT COUNT(*) FROM bids WHERE job_id = j.id) AS bid_count
        FROM bids b
        JOIN jobs j ON b.job_id = j.id
        JOIN profiles p ON j.poster_id = p.id
        LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
        WHERE b.worker_id = p_user_id
          AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
        ORDER BY b.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    ) t;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
