-- ===========================================
-- CLEANUP DATA - Fresh Start
-- Removes all jobs, bids, chats, reviews, etc.
-- KEEPS all user profiles/accounts
-- ===========================================

-- 1. Delete chat messages
DELETE FROM chat_messages;

-- 2. Delete chats (references jobs)
DELETE FROM chats;

-- 3. Delete bids (must be before jobs due to FK)
DELETE FROM bids;

-- 3. Delete jobs
DELETE FROM jobs;

-- 4. Delete notifications
DELETE FROM notifications;

-- 5. Delete payments/transactions
DELETE FROM payments;
DELETE FROM transactions;

-- 6. Delete disputes
DELETE FROM disputes;

-- 7. Delete reviews
DELETE FROM reviews;

-- 8. Reset ALL wallet balances to 0
UPDATE profiles SET wallet_balance = 0;

-- 9. Add test wallet balances
UPDATE profiles SET wallet_balance = 10 WHERE email = 'as30041@gmail.com';
UPDATE profiles SET wallet_balance = 20 WHERE name ILIKE '%nitya%';

-- 10. Reset cancellation counts
UPDATE profiles SET in_progress_cancellations = 0;

-- 11. Verify cleanup
SELECT 'jobs' as table_name, COUNT(*) as count FROM jobs
UNION ALL SELECT 'bids', COUNT(*) FROM bids
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews;

-- Show users with wallet balances
SELECT name, email, wallet_balance FROM profiles WHERE wallet_balance > 0;
