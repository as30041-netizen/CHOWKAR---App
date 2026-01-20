-- 1. Check the 5 most recent webhooks (Look for IDs starting with 'pay_')
SELECT id, processed_at, LEFT(payload::text, 100) as payload_preview
FROM processed_webhooks
ORDER BY processed_at DESC
LIMIT 10;

-- 2. Check for a specific user's transactions (REPLACE with User ID)
-- SELECT * FROM wallet_transactions 
-- WHERE wallet_id = 'your-user-id-here' 
-- ORDER BY created_at DESC;

-- 3. Check if the wallet exists for the user
-- SELECT * FROM wallets WHERE user_id = 'your-user-id-here';

-- 4. Check if there are any specific errors in the processed_webhooks (if you added error logging)
-- (No error column in current schema, but we can see payloads)

-- 5. Verify the ID column type and constraints
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'processed_webhooks';
