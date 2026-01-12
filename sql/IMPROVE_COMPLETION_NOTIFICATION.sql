-- ============================================
-- IMPROVE JOB COMPLETION NOTIFICATION MESSAGE
-- ============================================

CREATE OR REPLACE FUNCTION notify_on_job_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
  v_bid_amount INTEGER;
  v_worker_name TEXT;
  v_poster_name TEXT;
BEGIN
  -- Only proceed if job was just completed
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    
    -- Get accepted bid details
    SELECT worker_id, amount INTO v_worker_id, v_bid_amount
    FROM bids
    WHERE id = NEW.accepted_bid_id;
    
    IF v_worker_id IS NOT NULL THEN
      -- Get worker name
      SELECT name INTO v_worker_name FROM profiles WHERE id = v_worker_id;
      
      -- Get poster name
      SELECT name INTO v_poster_name FROM profiles WHERE id = NEW.poster_id;
      
      -- Notify worker with improved message
      INSERT INTO notifications (user_id, type, title, message, related_job_id, read, created_at)
      VALUES (
        v_worker_id,
        'SUCCESS',
        '🎊 Job Complete! You Earned ₹' || v_bid_amount,
        COALESCE(v_poster_name, 'The employer') || ' marked "' || NEW.title || '" as complete. Great work! Don''t forget to rate your experience.',
        NEW.id,
        false,
        NOW()
      );
      
      RAISE NOTICE '✅ Completion notification sent to worker %', v_worker_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Verify
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Updated notify_on_job_completion function';
  RAISE NOTICE '';
  RAISE NOTICE 'New notification:';
  RAISE NOTICE '  Title: "🎊 Job Complete! You Earned ₹[Amount]"';
  RAISE NOTICE '  Message: "[Poster] marked [Job] as complete. Great work! Don''t forget to rate your experience."';
  RAISE NOTICE '';
END $$;
