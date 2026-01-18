-- ============================================================================
-- DASHBOARD SYNC FIX
-- Ensures that get_dashboard_stats and feeds use identical logic.
-- ============================================================================

BEGIN;

-- 1. DROP EXISTING TO AVOID CONFLICTS
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_my_applications_feed(UUID, INTEGER, INTEGER) CASCADE;

-- 2. MASTER DASHBOARD STATS
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_poster_active INTEGER;
    v_poster_history INTEGER;
    v_worker_active INTEGER;
    v_worker_history INTEGER;
BEGIN
    -- Poster Active: My jobs that are OPEN or IN_PROGRESS
    SELECT COUNT(*) INTO v_poster_active
    FROM jobs
    WHERE poster_id = p_user_id
      AND status IN ('OPEN', 'IN_PROGRESS');

    -- Poster History: My jobs that are COMPLETED or CANCELLED
    SELECT COUNT(*) INTO v_poster_history
    FROM jobs
    WHERE poster_id = p_user_id
      AND status IN ('COMPLETED', 'CANCELLED');

    -- Worker Active: Jobs I bid on that are still "active" for me
    -- (Job is OPEN and my bid is PENDING/ACCEPTED, OR Job is IN_PROGRESS and I'm the winner)
    SELECT COUNT(DISTINCT j.id) INTO v_worker_active
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND (
          (j.status = 'OPEN' AND b.status IN ('PENDING', 'ACCEPTED'))
          OR 
          (j.status = 'IN_PROGRESS' AND j.accepted_bid_id = b.id)
      );

    -- Worker History: Jobs/Bids that are finished for me
    -- (My bid was REJECTED, OR the job is COMPLETED/CANCELLED, OR someone else won)
    SELECT COUNT(DISTINCT j.id) INTO v_worker_history
    FROM jobs j
    JOIN bids b ON b.job_id = j.id
    LEFT JOIN user_job_visibility v ON v.job_id = j.id AND v.user_id = p_user_id
    WHERE b.worker_id = p_user_id
      AND (v.is_hidden IS NULL OR v.is_hidden = FALSE)
      AND (
          b.status = 'REJECTED'
          OR j.status IN ('COMPLETED', 'CANCELLED')
          OR (j.status != 'OPEN' AND j.accepted_bid_id != b.id)
      );

    RETURN jsonb_build_object(
        'poster_active', v_poster_active,
        'poster_history', v_poster_history,
        'worker_active', v_worker_active,
        'worker_history', v_worker_history
    );
END;
$$;

-- 3. UPDATED APPLICATIONS FEED (Aligned with Stats Logic)
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

COMMIT;
