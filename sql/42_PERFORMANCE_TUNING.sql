-- ============================================================================
-- SQL: PERFORMANCE TUNING (Phase 42)
-- Purpose: Add critical indexes to support "Viral Caching", "Personalization", 
--          and "Geo-Location" without burdening the database.
-- ============================================================================

BEGIN;

-- 0. Enable Required Extensions (for Geo-Location)
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- 1. JSONB Index for Translations (Viral Caching)
-- Allows fast lookups if we ever need to query "jobs with Punjabi translation"
CREATE INDEX IF NOT EXISTS idx_jobs_translations_gin ON jobs USING gin (translations);

-- 2. Spatial Index for Location (Map & Feed)
-- Drastically speeds up "Nearest" and "Radius" queries
CREATE INDEX IF NOT EXISTS idx_jobs_location_geo ON jobs USING gist (ll_to_earth(latitude, longitude));

-- 3. Category Index (Personalization)
-- Speeds up "Recommended" feed matching
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);

-- 4. Composite Indexes for Feed Sorting (Speed up ORDER BY created_at)
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_worker_created_at ON bids(worker_id, created_at DESC);

-- 5. User Visibility Index (Hiding/Blocking)
CREATE INDEX IF NOT EXISTS idx_user_job_visibility_lookup ON user_job_visibility(user_id, job_id);

COMMIT;

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Performance Boost Deployed: Indexes added for Scale.'; 
END $$;
