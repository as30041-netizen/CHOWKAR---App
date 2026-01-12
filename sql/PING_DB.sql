-- PING DATABASE
-- Check if jobs table is locked or just slow
-- If this runs quickly, the DB is fine. If it hangs, it's locked.

EXPLAIN ANALYZE SELECT id FROM jobs ORDER BY created_at DESC LIMIT 1;
