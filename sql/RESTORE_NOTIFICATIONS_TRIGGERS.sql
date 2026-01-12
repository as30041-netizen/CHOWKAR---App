-- RESTORE NOTIFICATION TRIGGERS
-- Required for In-App Notifications (Bell Icon)

BEGIN;

-- 1. Notify Poster on New Bid
CREATE OR REPLACE FUNCTION notify_on_bid_created()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_poster_id UUID;
  v_worker_name TEXT;
BEGIN
  -- Get job details
  SELECT title, poster_id INTO v_job_title, v_poster_id 
  FROM jobs WHERE id = NEW.job_id;
  
  -- Get worker name
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;

  -- Create Notification for Poster
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    created_at,
    updated_at -- Added based on recent fix
  ) VALUES (
    v_poster_id,
    'BID_RECEIVED',
    'New Bid Received',
    'Bid of ₹' || NEW.amount || ' from ' || COALESCE(v_worker_name, 'Unknown Worker') || ' on "' || v_job_title || '"',
    json_build_object('job_id', NEW.job_id, 'bid_id', NEW.id, 'worker_id', NEW.worker_id),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
CREATE TRIGGER on_bid_created_notify
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_created();


-- 2. Notify Worker on Bid Accepted
CREATE OR REPLACE FUNCTION notify_on_bid_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
BEGIN
  -- Only trigger when status changes to ACCEPTED
  IF OLD.status != 'ACCEPTED' AND NEW.status = 'ACCEPTED' THEN
    -- Get job details
    SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;

    -- Create Notification for Worker
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_at,
      updated_at
    ) VALUES (
      NEW.worker_id,
      'BID_ACCEPTED',
      'Bid Accepted!',
      'Your bid on "' || v_job_title || '" has been accepted.',
      json_build_object('job_id', NEW.job_id, 'bid_id', NEW.id),
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bid_accepted_notify ON bids;
CREATE TRIGGER on_bid_accepted_notify
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_accepted();

COMMIT;
