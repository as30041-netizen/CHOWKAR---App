-- FIX TRIGGER: Notify Poster on New Bid
CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
BEGIN
  -- Get job details
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  
  -- Get worker name
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;

  -- Notify poster
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (
    v_job.poster_id,
    'INFO',
    'New Bid Received! 🔔',
    COALESCE(v_worker_name, 'A worker') || ' placed a bid of ₹' || NEW.amount || ' on "' || v_job.title || '"',
    NEW.job_id,
    false,
    NOW()
  );

  RAISE NOTICE '✅ New bid notification sent to poster %', v_job.poster_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
CREATE TRIGGER on_bid_created_notify
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_on_new_bid();
