-- ============================================================================
-- CHOWKAR MASTER TRIGGERS
-- Consolidated Database Triggers
-- ============================================================================

BEGIN;

-- 1. BID COUNT MAINTENANCE
CREATE OR REPLACE FUNCTION maintain_job_bid_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE jobs SET bid_count = bid_count + 1 WHERE id = NEW.job_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE jobs SET bid_count = bid_count - 1 WHERE id = OLD.job_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maintain_job_bid_count ON bids;
CREATE TRIGGER trg_maintain_job_bid_count
AFTER INSERT OR DELETE ON bids
FOR EACH ROW
EXECUTE FUNCTION maintain_job_bid_count();


-- 2. NOTIFICATIONS TRIGGERS
-- A. Notify Poster on New Bid
CREATE OR REPLACE FUNCTION notify_poster_on_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_poster_id UUID;
BEGIN
  SELECT title, poster_id INTO v_job_title, v_poster_id FROM jobs WHERE id = NEW.job_id;
  INSERT INTO notifications (user_id, type, title, message, related_job_id)
  VALUES (v_poster_id, 'INFO', 'New Bid Received', 'New bid of ₹' || NEW.amount || ' on "' || v_job_title || '"', NEW.job_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
CREATE TRIGGER on_bid_created_notify
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_on_new_bid();

-- B. Notify Worker on Counter
CREATE OR REPLACE FUNCTION notify_worker_on_counter()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
BEGIN
  IF (NEW.amount != OLD.amount) AND NEW.status = 'PENDING' AND OLD.worker_id = NEW.worker_id THEN
    SELECT title INTO v_job_title FROM jobs WHERE id = NEW.job_id;
    INSERT INTO notifications (user_id, type, title, message, related_job_id)
    VALUES (NEW.worker_id, 'INFO', 'Counter Offer', 'New offer of ₹' || NEW.amount || ' for "' || v_job_title || '"', NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_bid_counter_notify ON bids;
CREATE TRIGGER on_bid_counter_notify
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_worker_on_counter();

-- 3. WALLET AUTO-CREATION
CREATE OR REPLACE FUNCTION handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance) VALUES (NEW.id, 50) ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_wallet ON profiles;
CREATE TRIGGER on_profile_created_wallet
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION handle_new_user_wallet();

COMMIT;
