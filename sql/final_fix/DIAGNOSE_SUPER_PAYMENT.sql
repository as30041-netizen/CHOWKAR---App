-- ==========================================
-- DIAGNOSE SUPER PLAN PAYMENT ISSUE
-- Description: Check what's happening with SUPER plan payments
-- ==========================================

-- 1. Check recent payments table to see what plan_id is being stored
SELECT 
    id,
    user_id,
    order_id,
    plan_id,  -- This should be 'SUPER'
    amount,
    status,
    created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check profiles to see what subscription_plan users have
SELECT 
    id,
    name,
    subscription_plan,  -- Should be 'SUPER' if payment worked
    subscription_expiry,
    is_premium,
    created_at as user_created
FROM profiles
WHERE subscription_plan IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if SUPER is in the allowed values for payments table
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'payments'
AND con.contype = 'c'; -- check constraints

-- 4. Find the specific user who paid for SUPER but got WORKER_PLUS
-- (Replace the email or phone with the actual user's info)
SELECT 
    p.id,
    p.name,
    p.email,
    p.phone,
    p.subscription_plan,
    pay.plan_id as payment_plan_id,
    pay.amount,
    pay.status,
    pay.created_at as payment_date
FROM profiles p
LEFT JOIN payments pay ON pay.user_id = p.id
WHERE p.subscription_plan = 'WORKER_PLUS'
  AND pay.amount = 12900  -- SUPER plan amount in paise (₹129)
ORDER BY pay.created_at DESC
LIMIT 5;
