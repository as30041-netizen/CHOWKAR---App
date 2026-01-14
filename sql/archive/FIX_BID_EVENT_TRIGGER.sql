-- ============================================
-- FIX: Make notify_on_bid_event UPDATE-only trigger
-- ============================================

-- Drop the old trigger that fires on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_notify_on_bid_event ON bids;

-- Recreate as UPDATE-only (for counter-offers)
CREATE TRIGGER trg_notify_on_bid_event
AFTER UPDATE ON bids
FOR EACH ROW
EXECUTE FUNCTION notify_on_bid_event();

-- Verify triggers now
SELECT 
  tgname as trigger_name,
  CASE 
    WHEN pg_get_triggerdef(oid) LIKE '%INSERT%' AND pg_get_triggerdef(oid) LIKE '%UPDATE%' THEN 'INSERT+UPDATE'
    WHEN pg_get_triggerdef(oid) LIKE '%INSERT%' THEN 'INSERT'
    WHEN pg_get_triggerdef(oid) LIKE '%UPDATE%' THEN 'UPDATE'
    WHEN pg_get_triggerdef(oid) LIKE '%DELETE%' THEN 'DELETE'
    ELSE 'OTHER'
  END as fires_on
FROM pg_trigger
WHERE tgrelid = 'bids'::regclass
  AND tgname NOT LIKE 'RI_%'
ORDER BY tgname;

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger trg_notify_on_bid_event now fires on UPDATE only';
END $$;
