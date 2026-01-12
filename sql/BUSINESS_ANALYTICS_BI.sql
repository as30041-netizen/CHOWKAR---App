-- ============================================================================
-- 📊 CHOWKAR BUSINESS INTELLIGENCE: MARKET INSIGHTS
-- Provides aggregate data for the Business Analytics dashboard.
-- Uses the preserved "Soft-Deleted" data to generate trends.
-- ============================================================================

BEGIN;

-- 1. Get Market Overview (Aggregates)
CREATE OR REPLACE FUNCTION get_market_analytics()
RETURNS TABLE (
  total_jobs BIGINT,
  total_completed BIGINT,
  total_hidden BIGINT,
  market_cap_completed BIGINT,
  total_bids BIGINT,
  avg_bids_per_job NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_jobs,
    COUNT(*) FILTER (WHERE status = 'COMPLETED')::BIGINT as total_completed,
    (SELECT COUNT(*) FROM user_job_visibility WHERE is_hidden = TRUE)::BIGINT as total_hidden,
    COALESCE(SUM(budget) FILTER (WHERE status = 'COMPLETED'), 0)::BIGINT as market_cap_completed,
    (SELECT COUNT(*) FROM bids)::BIGINT as total_bids,
    ROUND(AVG(bid_count), 2)::NUMERIC as avg_bids_per_job
  FROM jobs;
END;
$$;

-- 2. Get Trends by Category
CREATE OR REPLACE FUNCTION get_category_trends()
RETURNS TABLE (
  category TEXT,
  job_count BIGINT,
  avg_budget NUMERIC,
  completion_rate NUMERIC,
  withdrawal_rate NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.category,
    COUNT(*)::BIGINT as job_count,
    ROUND(AVG(j.budget), 0)::NUMERIC as avg_budget,
    ROUND(
      (COUNT(*) FILTER (WHERE j.status = 'COMPLETED')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 
      1
    ) as completion_rate,
    ROUND(
      ((SELECT COUNT(*) FROM bids b WHERE b.job_id IN (SELECT id FROM jobs WHERE category = j.category) AND b.status = 'REJECTED')::NUMERIC / 
       NULLIF((SELECT COUNT(*) FROM bids b WHERE b.job_id IN (SELECT id FROM jobs WHERE category = j.category)), 0) * 100),
      1
    ) as withdrawal_rate
  FROM jobs j
  GROUP BY j.category
  ORDER BY job_count DESC;
END;
$$;

-- 3. Get Recent Activity Logs (Preserved History)
CREATE OR REPLACE FUNCTION get_admin_activity_log(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  event_time TIMESTAMPTZ,
  event_type TEXT,
  description TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  (
    SELECT created_at as event_time, 'JOB_CREATED' as event_type, title as description FROM jobs
    UNION ALL
    SELECT created_at as event_time, 'BID_PLACED' as event_type, 'Bid of ₹' || amount || ' placed' as description FROM bids
    UNION ALL
    SELECT hidden_at as event_time, 'JOB_HIDDEN' as event_type, 'Job ID ' || job_id || ' hidden by user' as description FROM user_job_visibility
  )
  ORDER BY event_time DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions to authenticated users (or restrict to admins if you have a role system)
GRANT EXECUTE ON FUNCTION get_market_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_trends() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_activity_log(INTEGER) TO authenticated;

COMMIT;
