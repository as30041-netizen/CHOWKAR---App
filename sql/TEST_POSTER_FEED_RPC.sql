-- TEST THE POSTER FEED RPC
-- Replace the UUID with the actual poster's user ID

SELECT * FROM get_my_jobs_feed(
  'e266fa3d-d854-4445-be8b-cd054a2fa859'::UUID,  -- poster user ID
  20,  -- limit
  0    -- offset
);
