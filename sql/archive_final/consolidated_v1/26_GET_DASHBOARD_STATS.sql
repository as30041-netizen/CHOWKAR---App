-- ============================================================================
-- GET DASHBOARD STATS RPC
-- Returns counts for different tabs in the Worker and Poster dashboards.
-- ============================================================================

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
    -- 1. Poster Active: Jobs I posted that are NOT completed/cancelled
    SELECT COUNT(*) INTO v_poster_active
    FROM jobs
    WHERE poster_id = p_user_id
      AND status NOT IN ('COMPLETED', 'CANCELLED', 'HIDDEN');

    -- 2. Poster History: Jobs I posted that ARE completed or cancelled (and not hidden)
    SELECT COUNT(*) INTO v_poster_history
    FROM jobs
    WHERE poster_id = p_user_id
      AND status IN ('COMPLETED', 'CANCELLED')
      AND status != 'HIDDEN';

    -- 3. Worker Active: Jobs I've bid on that are still "active" for me
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

    -- 4. Worker History: Jobs/Bids that are finished
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
