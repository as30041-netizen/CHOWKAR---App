-- ==========================================================
-- FIX ALL NOTIFICATION & REALTIME ISSUES (ALL-IN-ONE SCRIPT)
-- ==========================================================
-- Run this script to ensure:
-- 1. Counter-offer notifications are generated correctly (No duplicates, no self-notif)
-- 2. Realtime subscriptions work (RLS policies + Publication)
-- 3. Push Token Sync (FCM) is preserved

-- ============================================
-- PART 1: NOTIFICATION TRIGGER LOGIC
-- ============================================

-- Function to handle counter offer notifications
CREATE OR REPLACE FUNCTION notify_on_counter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_worker_name TEXT;
  v_poster_name TEXT;
  v_last_negotiator_role TEXT;
  v_recipient_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_history_length INTEGER;
  v_old_history_length INTEGER;
BEGIN
  -- Check negotiation history growth
  v_history_length := COALESCE(jsonb_array_length(NEW.negotiation_history::jsonb), 0);
  v_old_history_length := COALESCE(jsonb_array_length(OLD.negotiation_history::jsonb), 0);
  
  IF v_history_length <= v_old_history_length OR v_history_length = 0 THEN
    RETURN NEW; -- No new negotiation step
  END IF;
  
  IF NEW.status != 'PENDING' THEN
    RETURN NEW; -- Only notify on pending counters
  END IF;
  
  -- Get context
  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  SELECT name INTO v_worker_name FROM profiles WHERE id = NEW.worker_id;
  
  -- Determine WHO made the move
  v_last_negotiator_role := NEW.negotiation_history::jsonb->-1->>'by';
  
  -- Target the OTHER party
  IF v_last_negotiator_role = 'POSTER' THEN
    v_recipient_id := NEW.worker_id;
    v_notification_title := 'Counter Offer Received 💸';
    v_notification_message := 'Employer countered with ₹' || NEW.amount || '.';
  ELSIF v_last_negotiator_role = 'WORKER' THEN
    v_recipient_id := v_job.poster_id;
    v_notification_title := 'New Counter Offer 💰';
    v_notification_message := COALESCE(v_worker_name, 'Worker') || ' proposed ₹' || NEW.amount || '.';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Insert (This will also trigger the FCM Push Sync if that script was run)
  INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
  VALUES (v_recipient_id, 'INFO', v_notification_title, v_notification_message, NEW.job_id, false, NOW());
  
  RETURN NEW;
END;
$$;

-- Drop old/duplicate triggers
DROP TRIGGER IF EXISTS trigger_notify_on_counter_offer ON bids;
DROP TRIGGER IF EXISTS on_counter_offer_notify ON bids;
DROP TRIGGER IF EXISTS notify_counter_offer ON bids;

-- Create single clean trigger
CREATE TRIGGER trigger_notify_on_counter_offer
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_counter_offer();


-- ============================================
-- PART 2: REALTIME CONFIGURATION
-- ============================================

-- 1. Enable RLS policy so users can read their own notifications via API
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO anon, authenticated
USING (user_id::text = auth.uid()::text);

-- 2. Enable Full Replica Identity (Required for correct realtime event payloads)
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 3. Add to Realtime Publication (Crucial for receiving events on frontend)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "notifications" is already in publication "supabase_realtime", skipping.';
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Successfully fixed Notification Logic & Realtime Settings!';
END $$;
