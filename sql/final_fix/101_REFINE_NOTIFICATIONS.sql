-- ============================================================================
-- FIX: REFINE NOTIFICATIONS & PURGE DUPLICATES (v4.1)
-- Purpose: 
-- 1.  Update notification message to use WORKER NAME instead of "Someone".
-- 2.  Aggressively PURGE any lingering triggers causing "New Bid received" spam.
-- ============================================================================

BEGIN;

-- 1. PURGE ALL TRIGGERS ON BIDS (Except the one we want)
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'bids' 
        AND trigger_name != 'trigger_v4_bid_master' -- KEEP THIS ONE
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg.trigger_name) || ' ON public.bids;';
        RAISE NOTICE 'Dropped legacy trigger: %', trg.trigger_name;
    END LOOP;
END $$;

-- 2. REFINE MASTER NOTIFICATION FUNCTION (Add Worker Name)
CREATE OR REPLACE FUNCTION public.v4_master_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job_title TEXT;
    v_party_name TEXT;
    v_recipient_id UUID;
    v_last_negotiator TEXT;
    v_history_length INTEGER;
    v_old_history_length INTEGER;
BEGIN
    -- 1. IDENTIFY THE JOB
    SELECT title INTO v_job_title FROM public.jobs WHERE id = NEW.job_id;

    -- CASE A: NEW BID (INSERT)
    IF (TG_OP = 'INSERT') THEN
        SELECT poster_id INTO v_recipient_id FROM public.jobs WHERE id = NEW.job_id;
        
        -- FETCH WORKER NAME (Explicitly!)
        SELECT name INTO v_party_name FROM public.profiles WHERE id = NEW.worker_id;

        -- PERSONALIZED MESSAGE
        INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
        VALUES (
            v_recipient_id, 
            'INFO', 
            'New Bid Received 💰', 
            COALESCE(v_party_name, 'A Worker') || ' bid ₹' || NEW.amount || ' on "' || v_job_title || '".', 
            NEW.job_id, 
            NOW()
        );
        RETURN NEW;
    END IF;

    -- CASE B: BID ACCEPTED (UPDATE)
    IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
        SELECT name INTO v_party_name FROM public.profiles WHERE id = (SELECT poster_id FROM jobs WHERE id = NEW.job_id);
        
        -- Winner
        INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
        VALUES (NEW.worker_id, 'SUCCESS', 'You Got the Job! 🎉', COALESCE(v_party_name, 'Employer') || ' selected you for "' || v_job_title || '".', NEW.job_id, NOW());

        -- Soft Rejections
        INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
        SELECT worker_id, 'INFO', 'Job Update', 'Another worker was selected for "' || v_job_title || '".', NEW.job_id, NOW()
        FROM public.bids WHERE job_id = NEW.job_id AND id != NEW.id AND status = 'PENDING';
        
        RETURN NEW;
    END IF;

    -- CASE C: BID REJECTED (UPDATE)
    IF NEW.status = 'REJECTED' AND (OLD.status IS NULL OR OLD.status != 'REJECTED') THEN
        v_last_negotiator := NEW.negotiation_history::jsonb->-1->>'by';
        IF v_last_negotiator = 'WORKER' THEN
            SELECT name INTO v_party_name FROM public.profiles WHERE id = NEW.worker_id;
            INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
            VALUES ((SELECT poster_id FROM public.jobs WHERE id = NEW.job_id), 'WARNING', 'Offer Declined', COALESCE(v_party_name, 'Worker') || ' declined your offer.', NEW.job_id, NOW());
        ELSE
            INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
            VALUES (NEW.worker_id, 'INFO', 'Bid Update', 'The employer chose a different worker for "' || v_job_title || '".', NEW.job_id, NOW());
        END IF;
        RETURN NEW;
    END IF;

    -- CASE D: COUNTER OFFER (UPDATE)
    v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
    v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);

    IF v_history_length > v_old_history_length AND NEW.status = 'PENDING' THEN
        v_last_negotiator := NEW.negotiation_history::jsonb->-1->>'by';
        IF v_last_negotiator = 'POSTER' THEN
            SELECT name INTO v_party_name FROM public.profiles WHERE id = (SELECT poster_id FROM jobs WHERE id = NEW.job_id);
            INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
            VALUES (NEW.worker_id, 'INFO', 'Counter Offer Received 💸', COALESCE(v_party_name, 'Employer') || ' countered with ₹' || NEW.amount || '.', NEW.job_id, NOW());
        ELSIF v_last_negotiator = 'WORKER' THEN
            SELECT name INTO v_party_name FROM public.profiles WHERE id = NEW.worker_id;
            INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
            VALUES ((SELECT poster_id FROM jobs WHERE id = NEW.job_id), 'INFO', 'New Counter Offer 💰', COALESCE(v_party_name, 'Worker') || ' proposed ₹' || NEW.amount || '.', NEW.job_id, NOW());
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
