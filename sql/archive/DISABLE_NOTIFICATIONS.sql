-- DISABLE NOTIFICATIONS TEMPORARILY
-- To unblock database inserts and updates if the notification service is hanging

DROP TRIGGER IF EXISTS on_bid_created_notify ON bids;
DROP TRIGGER IF EXISTS notify_on_bid_accept ON bids;
DROP TRIGGER IF EXISTS notify_on_counter_offer ON bids;
DROP TRIGGER IF EXISTS on_bid_message_notify ON bids;

-- Also the new one we added
DROP TRIGGER IF EXISTS trg_maintain_job_bid_count ON bids;
