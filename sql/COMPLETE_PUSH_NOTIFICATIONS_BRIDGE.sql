-- ============================================================================
-- COMPLETE_PUSH_NOTIFICATIONS_BRIDGE.sql
-- Bridges non-notification events to the 'notifications' table to trigger mobile push.
-- ============================================================================

-- 1. CHAT MESSAGE BRIDGE
-- Notifies the recipient whenever a new message is sent.
CREATE OR REPLACE FUNCTION handle_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
BEGIN
    SELECT name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
    
    INSERT INTO notifications (user_id, title, message, type, related_job_id, created_at)
    VALUES (
        NEW.receiver_id,
        'New Message from ' || COALESCE(v_sender_name, 'User'),
        CASE 
            WHEN LENGTH(NEW.text) > 50 THEN SUBSTRING(NEW.text FROM 1 FOR 50) || '...'
            ELSE NEW.text 
        END,
        'INFO', -- Matches key for chat navigation deep linking
        NEW.job_id,
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_notification_push ON chat_messages;
CREATE TRIGGER trg_chat_notification_push
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION handle_new_chat_message();


-- 2. JOB STATUS CHANGE BRIDGE
-- Notifies workers when a job is marked COMPLETED or CANCELLED.
CREATE OR REPLACE FUNCTION handle_job_status_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_recipient_id UUID;
    v_title TEXT;
    v_message TEXT;
BEGIN
    -- Only trigger if status changes
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;

    -- Job Completed (Notify the worker)
    IF NEW.status = 'COMPLETED' THEN
        v_recipient_id := (SELECT worker_id FROM bids WHERE id = NEW.accepted_bid_id);
        IF v_recipient_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, title, message, type, related_job_id)
            VALUES (v_recipient_id, '🎉 Job Completed', 'The job "' || NEW.title || '" has been marked as completed. Don''t forget to review the employer!', 'SUCCESS', NEW.id);
        END IF;
    END IF;

    -- Job Cancelled (Notify the accepted worker)
    IF NEW.status = 'CANCELLED' THEN
        v_recipient_id := (SELECT worker_id FROM bids WHERE id = NEW.accepted_bid_id);
        IF v_recipient_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, title, message, type, related_job_id)
            VALUES (v_recipient_id, '⚠️ Job Cancelled', 'The job "' || NEW.title || '" has been cancelled by the employer.', 'WARNING', NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_status_notification ON jobs;
CREATE TRIGGER trg_job_status_notification
AFTER UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION handle_job_status_notification();


-- 3. REVIEW NOTIFICATION BRIDGE
-- Notifies the reviewee whenever they receive a new rating/review.
CREATE OR REPLACE FUNCTION handle_new_review_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_reviewer_name TEXT;
BEGIN
    SELECT name INTO v_reviewer_name FROM profiles WHERE id = NEW.reviewer_id;

    INSERT INTO notifications (user_id, title, message, type, related_job_id)
    VALUES (
        NEW.reviewee_id, 
        '⭐ New Review Received', 
        COALESCE(v_reviewer_name, 'Someone') || ' left you a ' || NEW.rating || '-star review!', 
        'INFO', 
        NEW.job_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_review_notification_push ON reviews;
CREATE TRIGGER trg_review_notification_push
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION handle_new_review_notification();
