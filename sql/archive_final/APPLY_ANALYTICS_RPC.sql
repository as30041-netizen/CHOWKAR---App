-- ============================================================================
-- 📊 CHOWKAR BUSINESS INTELLIGENCE: MARKET INSIGHTS (CORRECTED)
-- Provides aggregate data for the Business Analytics dashboard.
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
    (SELECT COUNT(*) FROM jobs)::BIGINT as total_jobs,
    (SELECT COUNT(*) FROM jobs WHERE status = 'COMPLETED')::BIGINT as total_completed,
    (SELECT COUNT(*) FROM user_job_visibility WHERE is_hidden = TRUE)::BIGINT as total_hidden,
    COALESCE((SELECT SUM(budget) FROM jobs WHERE status = 'COMPLETED'), 0)::BIGINT as market_cap_completed,
    (SELECT COUNT(*) FROM bids)::BIGINT as total_bids,
    ROUND(
        COALESCE(
            (SELECT COUNT(*)::NUMERIC FROM bids) / NULLIF((SELECT COUNT(*)::NUMERIC FROM jobs), 0),
            0
        ), 2
    )::NUMERIC as avg_bids_per_job;
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
      (
        (SELECT COUNT(*) FROM bids b 
         JOIN jobs j2 ON b.job_id = j2.id 
         WHERE j2.category = j.category AND b.status = 'REJECTED'
        )::NUMERIC 
        / 
        NULLIF((SELECT COUNT(*) FROM bids b JOIN jobs j2 ON b.job_id = j2.id WHERE j2.category = j.category), 0) 
        * 100
      ),
      1
    ) as withdrawal_rate
  FROM jobs j
  GROUP BY j.category
  ORDER BY job_count DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_market_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_trends() TO authenticated;

COMMIT;
