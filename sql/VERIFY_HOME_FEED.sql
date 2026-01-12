-- Verify get_home_feed works after creating it
SELECT * FROM get_home_feed('69c95415-770e-4da4-8bf8-25084ace911b', 10, 0)
LIMIT 5;
