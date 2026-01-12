-- Find ALL versions of get_home_feed
SELECT 
    proname,
    oidvectortypes(proargtypes) as argument_types,
    pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'get_home_feed';
