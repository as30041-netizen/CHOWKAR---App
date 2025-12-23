-- ============================================================================
-- CLEANUP DUPLICATE TRIGGERS
-- ============================================================================
-- The user reported duplicate notifications. This was caused by two conflicting
-- triggers existing simultaneously:
-- 1. trigger_notify_on_counter_offer (The correct, new one)
-- 2. trigger_notify_on_bid_negotiation (The old, legacy one)
--
-- This script removes the legacy trigger and function to stop the duplicates.
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_notify_on_bid_negotiation ON bids;
DROP FUNCTION IF EXISTS notify_on_bid_negotiation();

-- Also ensure we don't have any other variants
DROP TRIGGER IF EXISTS on_bid_negotiation ON bids;

DO $$
BEGIN
    RAISE NOTICE '✅ CLEANUP COMPLETE: Duplicate notification triggers removed.';
END $$;
