-- ENSURE_LIMITS_AND_TRIGGERS.sql
-- Purpose: Guarantee that Subscription Limits are enforced on Bids and Jobs
-- Context: User bought Worker Plus, we must ensure they are NOT blocked by limits.

BEGIN;

-- 1. CENTRAL POLICY FUNCTION (The Brain)
CREATE OR REPLACE FUNCTION check_subscription_policy(
    p_user_id UUID,
    p_action TEXT -- 'POST_JOB' | 'PLACE_BID'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan TEXT;
    v_count INT;
    v_limit INT;
    v_period_start TIMESTAMPTZ;
BEGIN
    -- Get User Plan (Default to FREE)
    SELECT COALESCE(subscription_plan, 'FREE') INTO v_plan
    FROM profiles
    WHERE id = p_user_id;

    -- ===========================
    -- ACTION: POST_JOB
    -- ===========================
    IF p_action = 'POST_JOB' THEN
        -- UNLIMITED Plans
        IF v_plan = 'PRO_POSTER' THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Pro Poster Plan');
        END IF;

        -- Limit: 3 per month
        v_limit := 3;
        v_period_start := date_trunc('month', now());
        
        -- Count usage
        SELECT COUNT(*) INTO v_count
        FROM jobs
        WHERE poster_id = p_user_id
        AND created_at >= extract(epoch from v_period_start);

    -- ===========================
    -- ACTION: PLACE_BID
    -- ===========================
    ELSIF p_action = 'PLACE_BID' THEN
        -- UNLIMITED Plans
        IF v_plan = 'WORKER_PLUS' THEN
            RETURN jsonb_build_object('allowed', true, 'reason', 'Worker Plus Plan');
        END IF;

        -- Limit: 5 per WEEK
        v_limit := 5;
        v_period_start := date_trunc('week', now()); -- Starts Monday

        -- Count usage
        SELECT COUNT(*) INTO v_count
        FROM bids
        WHERE worker_id = p_user_id
        AND created_at >= extract(epoch from v_period_start);
        
    ELSE
        RETURN jsonb_build_object('allowed', false, 'reason', 'Invalid Action');
    END IF;

    -- ===========================
    -- CHECK & RETURN
    -- ===========================
    IF v_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false, 
            'reason', 'Limit Reached', 
            'upgrade_required', true,
            'current_usage', v_count,
            'limit', v_limit
        );
    ELSE
        RETURN jsonb_build_object(
            'allowed', true, 
            'reason', 'Within Limit', 
            'current_usage', v_count,
            'limit', v_limit
        );
    END IF;
END;
$$;


-- 2. TRIGGER FUNCTION (The Enforcer)
-- For Bids
CREATE OR REPLACE FUNCTION enforce_bid_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy JSONB;
BEGIN
    -- Check policy
    SELECT check_subscription_policy(NEW.worker_id, 'PLACE_BID') INTO v_policy;
    
    -- If allowed is false, ABORT transaction with clear message
    IF (v_policy->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: You have used %/% bids this week. Upgrade to Worker Plus for Unlimited Bids.', v_policy->>'current_usage', v_policy->>'limit';
    END IF;

    RETURN NEW;
END;
$$;

-- For Jobs
CREATE OR REPLACE FUNCTION enforce_job_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy JSONB;
BEGIN
    SELECT check_subscription_policy(NEW.poster_id, 'POST_JOB') INTO v_policy;
    
    IF (v_policy->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: You have posted %/% jobs this month. Upgrade to Pro Poster for Unlimited Posts.', v_policy->>'current_usage', v_policy->>'limit';
    END IF;

    RETURN NEW;
END;
$$;


-- 3. APPLY TRIGGERS (Idempotent)
DROP TRIGGER IF EXISTS trg_enforce_bid_limit ON bids;
CREATE TRIGGER trg_enforce_bid_limit
    BEFORE INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION enforce_bid_limit_trigger();

DROP TRIGGER IF EXISTS trg_enforce_job_limit ON jobs;
CREATE TRIGGER trg_enforce_job_limit
    BEFORE INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION enforce_job_limit_trigger();

COMMIT;
