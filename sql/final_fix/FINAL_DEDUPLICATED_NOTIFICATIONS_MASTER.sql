-- ============================================================================
-- 🚀 FINAL DEDUPLICATED NOTIFICATIONS MASTER (v4 - RPC Pure Edition)
-- ============================================================================
-- 1. Cleans up all legacy triggers.
-- 2. Removes redundant "INSERT INTO notifications" from common RPCs.
-- 3. Solidifies a single "v4_notify" trigger for ALL bid/chat events.
-- ============================================================================

-- 1. PURGE ALL LEGACY TRIGGERS
DROP TRIGGER IF EXISTS on_notification_created_fcm_push ON public.notifications;
DROP TRIGGER IF EXISTS trigger_notify_on_chat_message ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.chat_messages;
DROP TRIGGER IF EXISTS on_chat_message_created ON public.chat_messages;
DROP TRIGGER IF EXISTS notify_chat_message ON public.chat_messages;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_accept ON public.bids;
DROP TRIGGER IF EXISTS notify_on_bid_status_change ON public.bids;
DROP TRIGGER IF EXISTS on_bid_counter_notify ON public.bids;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON public.bids;
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer_v2 ON public.bids;
DROP TRIGGER IF EXISTS on_counter_offer_notify ON public.bids;
DROP TRIGGER IF EXISTS notify_counter_offer ON public.bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_negotiation ON public.bids;
DROP TRIGGER IF EXISTS trigger_counter_offer_final ON public.bids;
DROP TRIGGER IF EXISTS trigger_notify_on_bid_update ON public.bids;

DROP FUNCTION IF EXISTS public.notify_on_counter_offer() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_counter_offer_v2() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_counter_offer_final() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_bid_update() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_chat_message() CASCADE;

-- ============================================
-- 2. "PURE" RPCS (Removed internal notifications)
-- ============================================

-- ACTION: PLACE BID (Standard)
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
    v_poster_id UUID;
    v_job_title TEXT;
    v_new_bid_id UUID;
    v_worker_id UUID := auth.uid();
    v_current_balance INTEGER;
    v_bid_cost INTEGER := 1;
BEGIN
    IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Bid amount must be positive'); END IF;
    SELECT status, poster_id, title INTO v_job_status, v_poster_id, v_job_title FROM jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Job not found'); END IF;
    IF v_job_status != 'OPEN' THEN RETURN json_build_object('success', false, 'error', 'Job is not open'); END IF;
    
    SELECT balance INTO v_current_balance FROM wallets WHERE user_id = v_worker_id FOR UPDATE;
    IF v_current_balance IS NULL OR v_current_balance < v_bid_cost THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient coins.');
    END IF;

    UPDATE wallets SET balance = balance - v_bid_cost, updated_at = NOW() WHERE user_id = v_worker_id;
    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, description)
    VALUES (v_worker_id, -v_bid_cost, 'BID_FEE', 'Bid on Job: ' || v_job_title);

    INSERT INTO bids (job_id, worker_id, amount, message, status)
    VALUES (p_job_id, v_worker_id, p_amount, p_message, 'PENDING')
    RETURNING id INTO v_new_bid_id;

    -- NOTE: Removed Hardcoded Notification Insert. Handled by Trigger.
    RETURN json_build_object('success', true, 'bid_id', v_new_bid_id);
END;
$$;

-- ACTION: COUNTER BID (Negotiation)
CREATE OR REPLACE FUNCTION public.action_counter_bid(
    p_bid_id UUID,
    p_amount NUMERIC,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
    v_user_role TEXT;
    v_negotiation_entry JSONB;
BEGIN
    IF p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;
    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    
    IF auth.uid() = v_bid.worker_id THEN v_user_role := 'WORKER';
    ELSIF auth.uid() = v_job.poster_id THEN v_user_role := 'POSTER';
    ELSE RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_negotiation_entry := jsonb_build_object('by', v_user_role, 'amount', p_amount, 'message', p_message, 'at', extract(epoch from now()) * 1000);

    UPDATE bids
    SET amount = p_amount, message = p_message, 
        negotiation_history = COALESCE(negotiation_history, '[]'::jsonb) || v_negotiation_entry,
        status = 'PENDING', updated_at = now()
    WHERE id = p_bid_id;

    -- NOTE: Removed Hardcoded Notification Insert. Handled by Trigger.
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ACTION: REJECT BID (Explicit)
CREATE OR REPLACE FUNCTION public.action_reject_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bid RECORD;
    v_job RECORD;
BEGIN
    SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Bid not found'); END IF;
    SELECT * INTO v_job FROM jobs WHERE id = v_bid.job_id;
    IF auth.uid() != v_job.poster_id THEN RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); END IF;

    UPDATE bids SET status = 'REJECTED', updated_at = now() WHERE id = p_bid_id;

    -- NOTE: Removed Hardcoded Notification Insert. Handled by Trigger.
    RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================
-- 3. LOGIC: THE MASTER TRIGGER (DEDUPLICATED)
-- ============================================

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
        INSERT INTO public.notifications (user_id, type, title, message, related_job_id, created_at)
        VALUES (v_recipient_id, 'INFO', 'New Bid Received 💰', 'Someone bid ₹' || NEW.amount || ' on "' || v_job_title || '".', NEW.job_id, NOW());
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

-- 4. LOGIC: RICH CHAT NOTIFICATIONS
CREATE OR REPLACE FUNCTION public.notify_on_chat_messagev4()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_name TEXT;
    v_job_title TEXT;
BEGIN
    SELECT CASE WHEN NEW.sender_id = j.poster_id THEN b.worker_id ELSE j.poster_id END, p.name, j.title
    INTO v_recipient_id, v_sender_name, v_job_title
    FROM public.jobs j JOIN public.bids b ON b.job_id = j.id
    JOIN public.profiles p ON p.id = NEW.sender_id
    WHERE j.id = NEW.job_id AND b.id = j.accepted_bid_id;

    IF v_recipient_id IS NOT NULL AND v_recipient_id != NEW.sender_id THEN
        INSERT INTO public.notifications (user_id, title, message, type, related_job_id, created_at)
        VALUES (v_recipient_id, COALESCE(v_sender_name, 'Someone') || ' 💬', 
                CASE WHEN v_job_title IS NOT NULL THEN '"' || v_job_title || '": ' ELSE '' END || LEFT(NEW.content, 100), 
                'INFO', NEW.job_id, NOW());
    END IF;
    RETURN NEW;
END;
$$;

-- 5. THE BRIDGE: NOTIFICATION -> FCM (CREDENTIAL-SAFE)
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notificationv4()
RETURNS TRIGGER AS $$
DECLARE
    v_push_token TEXT;
    v_url TEXT := 'https://ghtshhafukyirwkfdype.supabase.co/functions/v1/send-push-notification';
    v_service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHNoaGFmdWt5aXJ3a2ZkeXBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5OTU0OSwiZXhwIjoyMDgzMzc1NTQ5fQ.9QodJ5Rrd7GCHK-MX38D4StXyLl1vufcTWt8EXybbo8';
    v_request_id BIGINT;
BEGIN
    SELECT push_token INTO v_push_token FROM public.profiles WHERE id = NEW.user_id;
    IF v_push_token IS NOT NULL AND v_push_token != '' THEN
        SELECT net.http_post(url := v_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_role_key),
            body := jsonb_build_object('userId', NEW.user_id, 'title', NEW.title, 'body', NEW.message, 'type', COALESCE(NEW.type, 'INFO'), 'relatedJobId', NEW.related_job_id, 'skipDb', true)::jsonb
        ) INTO v_request_id;
        INSERT INTO public.push_debug_logs (event, details, http_request_id) VALUES ('PUSH_ATTEMPT', 'Master v4 Queued ID: ' || v_request_id, v_request_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ATTACH EVERYTHING
CREATE TRIGGER trigger_notify_on_chatv4 AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_chat_messagev4();
CREATE TRIGGER trigger_v4_bid_master AFTER INSERT OR UPDATE ON public.bids FOR EACH ROW EXECUTE FUNCTION public.v4_master_notify();
CREATE TRIGGER on_notification_created_fcm_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.trigger_fcm_push_notificationv4();

-- 7. FINALIZE
DO $$ BEGIN RAISE NOTICE 'SUCCESS: MASTER v4 INSTALLED. REDUNDANT RPCS PURGED.'; END $$;
