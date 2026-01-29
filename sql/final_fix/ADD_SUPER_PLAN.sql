-- ==========================================
-- ADD SUPER PLAN
-- Description: Adds the new SUPER subscription plan (₹129/mo)
--              Unlimited Posts + Unlimited Bids + AI Tools
-- ==========================================

BEGIN;

-- 1. Update profiles table constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_plan_check 
CHECK (subscription_plan IN ('FREE', 'PRO_POSTER', 'WORKER_PLUS', 'SUPER'));

-- 2. Update subscriptions table constraint
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_id_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_check 
CHECK (plan_id IN ('FREE', 'PRO_POSTER', 'WORKER_PLUS', 'SUPER'));

COMMIT;
