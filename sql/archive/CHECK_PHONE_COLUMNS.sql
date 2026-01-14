-- CHECK: Phone columns in jobs and bids
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('jobs', 'bids') 
AND column_name LIKE '%phone%';
