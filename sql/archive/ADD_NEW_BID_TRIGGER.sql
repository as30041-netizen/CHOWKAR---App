-- ============================================
-- ADD TRIGGER FOR notify_poster_on_new_bid
-- ============================================

-- First, drop any existing trigger to avoid duplicates
DROP TRIGGER IF EXISTS trg_notify_poster_on_new_bid ON bids;

-- Create the trigger for INSERT only
CREATE TRIGGER trg_notify_poster_on_new_bid
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_poster_on_new_bid();

-- Verify all bid triggers
SELECT 
  tgname as trigger_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'bids'::regclass
  AND tgname NOT LIKE 'RI_%'
ORDER BY tgname;

-- Success
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger trg_notify_poster_on_new_bid created!';
  RAISE NOTICE 'New bids will now send SINGLE notification to poster.';
END $$;
