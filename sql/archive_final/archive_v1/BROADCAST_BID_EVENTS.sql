-- BROADCAST TRIGGER FOR NEW BIDS
-- This trigger sends a broadcast event when a new bid is inserted, 
-- allowing the Poster to receive real-time updates regardless of RLS policies.
-- The frontend listens for 'bid_inserted' broadcast on the 'global_sync' channel.

-- First, create the function that will broadcast the bid inserted event
CREATE OR REPLACE FUNCTION broadcast_bid_inserted()
RETURNS TRIGGER AS $$
DECLARE
  job_poster_id UUID;
BEGIN
  -- Get the poster_id of the job this bid is for
  SELECT poster_id INTO job_poster_id FROM public.jobs WHERE id = NEW.job_id;
  
  -- Broadcast the bid_inserted event to the 'global_sync' channel
  -- This uses Supabase's pg_notify extension to send realtime messages
  PERFORM pg_notify(
    'realtime:global_sync',
    json_build_object(
      'type', 'broadcast',
      'event', 'bid_inserted',
      'payload', row_to_json(NEW)
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the bids table
DROP TRIGGER IF EXISTS trigger_broadcast_bid_inserted ON public.bids;
CREATE TRIGGER trigger_broadcast_bid_inserted
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_bid_inserted();

-- Also create a trigger for bid updates (for counter-offers)
CREATE OR REPLACE FUNCTION broadcast_bid_updated()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'realtime:global_sync',
    json_build_object(
      'type', 'broadcast',
      'event', 'bid_updated',
      'payload', row_to_json(NEW)
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_broadcast_bid_updated ON public.bids;
CREATE TRIGGER trigger_broadcast_bid_updated
  AFTER UPDATE ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_bid_updated();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION broadcast_bid_inserted() TO authenticated;
GRANT EXECUTE ON FUNCTION broadcast_bid_updated() TO authenticated;
