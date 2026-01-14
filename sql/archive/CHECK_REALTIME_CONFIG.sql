-- check if replication is enabled for tables
SELECT
  relname AS table_name,
  relreplident AS replication_identity
FROM
  pg_class
JOIN
  pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE
  pg_namespace.nspname = 'public'
  AND relname IN ('jobs', 'bids', 'notifications');

-- Check if supabase_realtime publication exists and what tables it includes
SELECT 
  pubname, 
  schemaname, 
  tablename 
FROM 
  pg_publication_tables 
WHERE 
  pubname = 'supabase_realtime';
