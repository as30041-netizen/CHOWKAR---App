-- ============================================
-- SIMPLE SELECT VERIFICATION
-- ============================================
-- This script does NOT use complex logic.
-- It simply queries the database to see what exists.
-- You should see a TABLE of results below after running this.
-- ============================================

SELECT 
    tgname as "Trigger Name",
    tgrelid::regclass as "Table Name",
    CASE 
        WHEN tgenabled = 'O' THEN 'Enabled' 
        WHEN tgenabled = 'D' THEN 'Disabled'
        ELSE 'Unknown' 
    END as "Status"
FROM pg_trigger
WHERE tgname IN (
    'trg_notify_on_new_bid', 
    'trg_notify_on_bid_update', 
    'trg_notify_on_chat_message',
    'trigger_notify_on_new_bid', -- Legacy check
    'notify_on_new_message'      -- Legacy check
)
ORDER BY tgname;
