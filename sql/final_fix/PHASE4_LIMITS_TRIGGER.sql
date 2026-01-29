-- PHASE 4: STRICT ENFORCEMENT TRIGGERS
-- These triggers run BEFORE INSERT to physically block usage if limits are exceeded.

-- 1. Trigger Function for JOBS
CREATE OR REPLACE FUNCTION enforce_job_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy JSONB;
BEGIN
    -- Check policy via our central logic function
    -- We cast UUIDs effectively
    SELECT check_subscription_policy(NEW.poster_id, 'POST_JOB') INTO v_policy;
    
    -- If allowed is false, ABORT transaction
    IF (v_policy->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: %', v_policy->>'reason';
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Trigger Function for BIDS
CREATE OR REPLACE FUNCTION enforce_bid_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy JSONB;
BEGIN
    SELECT check_subscription_policy(NEW.worker_id, 'PLACE_BID') INTO v_policy;
    
    IF (v_policy->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'SUBSCRIPTION_LIMIT_REACHED: %', v_policy->>'reason';
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach Triggers (Drop if exists to be safe)
DROP TRIGGER IF EXISTS trg_enforce_job_limit ON jobs;
CREATE TRIGGER trg_enforce_job_limit
    BEFORE INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION enforce_job_limit_trigger();

DROP TRIGGER IF EXISTS trg_enforce_bid_limit ON bids;
CREATE TRIGGER trg_enforce_bid_limit
    BEFORE INSERT ON bids
    FOR EACH ROW
    EXECUTE FUNCTION enforce_bid_limit_trigger();
