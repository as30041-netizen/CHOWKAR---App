
-- CHECK LATEST TRANSACTIONS FOR DUPLICATES
SELECT 
    id, 
    created_at, 
    amount, 
    description, 
    type 
FROM 
    wallet_transactions 
ORDER BY 
    created_at DESC 
LIMIT 10;

-- CHECK IF IDEMPOTENCY TABLE EXISTS AND HAS DATA
SELECT count(*) as webhook_count FROM processed_webhooks;

-- CHECK RPC DEFINITION
select proname, prosrc from pg_proc where proname = 'admin_process_payment_webhook';
