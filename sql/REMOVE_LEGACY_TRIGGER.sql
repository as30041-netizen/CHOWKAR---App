-- ============================================
-- FINAL CLEANUP: Remove Legacy Trigger
-- ============================================
-- The audit revealed one persistent legacy trigger:
-- 'on_bid_accepted_notify'
--
-- This is redundant because 'trg_notify_on_bid_update' 
-- already handles bid acceptance notifications.
-- Keeping it will cause DOUBLE notifications for Hires.
-- ============================================

DROP TRIGGER IF EXISTS on_bid_accepted_notify ON bids;
DROP FUNCTION IF EXISTS on_bid_accepted_notify() CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Legacy trigger [on_bid_accepted_notify] removed.';
  RAISE NOTICE 'Notification system is now pure and optimized.';
END $$;
