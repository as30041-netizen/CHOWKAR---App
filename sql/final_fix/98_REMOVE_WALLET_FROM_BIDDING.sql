-- ============================================================================
-- CLEANUP: REMOVE LEGACY WALLET LOGIC FROM BIDDING (REFINED)
-- PURPOSE: Restore bidding functionality by removing all coin/wallet dependencies.
--          This version uses standard columns from the master schema.
-- ============================================================================

BEGIN;

-- 1. Redefine action_place_bid (Wallet-Free & Schema-Safe Version)
-- Drop first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.action_place_bid(uuid, integer, text);
DROP FUNCTION IF EXISTS public.action_accept_bid(uuid);

-- This version removes all balance checks and coin deductions.
CREATE OR REPLACE FUNCTION public.action_place_bid(
    p_job_id UUID,
    p_amount INTEGER,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_job_status TEXT;
    v_job_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
BEGIN
    -- 1. Validation: Basic Info
    -- Using direct column names from 'jobs' table
    SELECT status, poster_id, title INTO v_job_status, v_job_poster_id, v_job_title 
    FROM public.jobs WHERE id = p_job_id;
    
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is no longer open for bidding'); END IF;
    IF v_job_poster_id = v_worker_id THEN RETURN json_build_object('success', false, 'error', 'You cannot bid on your own job'); END IF;
    
    -- 2. Duplicate Check
    IF EXISTS (SELECT 1 FROM public.bids WHERE job_id = p_job_id AND worker_id = v_worker_id) THEN
        RETURN json_build_object('success', false, 'error', 'You have already placed a bid on this job');
    END IF;

    -- 3. Insert Bid (Using only columns verified in 00_schema.sql)
    INSERT INTO public.bids (
        job_id, 
        worker_id, 
        amount, 
        message, 
        status, 
        negotiation_history,
        created_at, 
        updated_at
    )
    VALUES (
        p_job_id, 
        v_worker_id, 
        p_amount, 
        p_message, 
        'PENDING', 
        jsonb_build_array(jsonb_build_object(
            'amount', p_amount, 
            'by', 'WORKER', 
            'at', extract(epoch from now()) * 1000,
            'message', p_message
        )),
        NOW(), 
        NOW()
    )
    RETURNING id INTO v_new_bid_id;

    -- NOTE: Notifications are handled by the v4_master_notify trigger 
    -- in FINAL_DEDUPLICATED_NOTIFICATIONS_MASTER.sql

    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

-- 2. Redefine action_accept_bid (Wallet-Free Version)
CREATE OR REPLACE FUNCTION public.action_accept_bid(
    p_bid_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
    v_poster_id UUID;
    v_worker_id UUID;
BEGIN
    -- 1. Fetch bid details
    SELECT job_id, worker_id INTO v_job_id, v_worker_id 
    FROM public.bids WHERE id = p_bid_id;
    
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Bid not found'); END IF;

    -- 2. Verify authorization
    SELECT poster_id INTO v_poster_id 
    FROM public.jobs WHERE id = v_job_id FOR UPDATE;
    
    IF v_poster_id != auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
    
    -- 3. Update Bid (Accept)
    UPDATE public.bids SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = p_bid_id;
    
    -- 4. Update Job
    UPDATE public.jobs SET status = 'IN_PROGRESS', accepted_bid_id = p_bid_id WHERE id = v_job_id;
    
    -- 5. Reject other pending bids
    UPDATE public.bids SET status = 'REJECTED' 
    WHERE job_id = v_job_id AND id != p_bid_id AND status = 'PENDING';

    -- 6. Initialize Chat Space (chat_states)
    INSERT INTO public.chat_states (user_id, job_id, is_archived, is_deleted)
    VALUES 
        (v_poster_id, v_job_id, false, false),
        (v_worker_id, v_job_id, false, false)
    ON CONFLICT (user_id, job_id) DO UPDATE SET is_archived = false, is_deleted = false;
    
    RETURN json_build_object('success', true);
END;
$$;

COMMIT;
