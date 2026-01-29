-- ============================================================================
-- MASTER DEPLOYMENT SCRIPT (DEPLOY_BACKEND.sql)
-- ----------------------------------------------------------------------------
-- This script deploys ALL payment and subscription logic in one go.
-- It combines:
-- 1. Wallet Webhooks (for Coin Purchases)
-- 2. Subscription RPCs (for Plan Upgrades)
-- 3. Schema Fixes (Tables, Columns, Indexes)
-- ============================================================================

BEGIN;

-- =========================================================
-- PART 1: SUBSCRIPTION & PLAN UPGRADES (From PHASE5)
-- =========================================================

-- 1.1 Payments Table for Subscriptions
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    order_id TEXT NOT NULL, -- Razorpay Order ID
    payment_id TEXT,        -- Razorpay Payment ID (Filled after success)
    amount INTEGER NOT NULL, -- Amount in Paies
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    plan_id TEXT NOT NULL,  -- WORKER_PLUS, PRO_POSTER
    created_at BIGINT DEFAULT extract(epoch from now())
);

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- 1.2 RPC to Create Order (Subscriptions)
CREATE OR REPLACE FUNCTION create_payment_order(
    p_user_id UUID,
    p_plan_id TEXT,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id TEXT;
BEGIN
    -- Simulate Order ID generation (In Prod, use Edge Function)
    v_order_id := 'order_' || floor(random() * 1000000)::text;

    INSERT INTO payments (user_id, order_id, amount, status, plan_id)
    VALUES (p_user_id, v_order_id, p_amount, 'PENDING', p_plan_id);

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'amount', p_amount,
        'currency', 'INR',
        'key', 'rzp_test_1DP5mmOlF5G5ag' -- Test Key injected here
    );
END;
$$;

-- 1.3 RPC to Verify Payment (Success Callback)
CREATE OR REPLACE FUNCTION verify_payment_success(
    p_order_id TEXT,
    p_payment_id TEXT,
    p_signature TEXT -- In real prod, verify this HMAC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    -- Find the payment record
    SELECT * INTO v_rec FROM payments WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- Update Payment Status
    UPDATE payments 
    SET status = 'SUCCESS', payment_id = p_payment_id
    WHERE order_id = p_order_id;

    -- UPDATE USER SUBSCRIPTION
    UPDATE profiles
    SET 
        subscription_plan = v_rec.plan_id,
        is_premium = true,
        -- Worker Plus gets Verified Badge automatically? Configurable.
        verified = (CASE WHEN v_rec.plan_id = 'WORKER_PLUS' THEN true ELSE verified END),
        -- Add 50 bonus coins for any upgrade? Optional.
        coins = coins + 0 
    WHERE id = v_rec.user_id;

    RETURN jsonb_build_object('success', true, 'new_plan', v_rec.plan_id);
END;
$$;


-- =========================================================
-- PART 2: WALLET WEBHOOKS (From FIX_PAYMENT_RPC)
-- =========================================================

-- 2.1 Ensure Webhook Tracking
CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    payload JSONB,
    order_id TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for Order ID deduplication
DROP INDEX IF EXISTS idx_processed_webhooks_order_id;
CREATE UNIQUE INDEX idx_processed_webhooks_order_id 
ON public.processed_webhooks (order_id) 
WHERE order_id IS NOT NULL AND order_id != 'unknown';

-- 2.2 Schema Repair for Wallet Transactions
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS transaction_type TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';

-- Drop restrictive constraints safely
DO $$ BEGIN
    ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2.3 RPC for Wallet Top-ups (Coins)
CREATE OR REPLACE FUNCTION admin_process_payment_webhook(
    p_event_id TEXT,
    p_user_id UUID,
    p_amount INTEGER,
    p_order_id TEXT,
    p_raw_event JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
    v_already_processed BOOLEAN;
BEGIN
    -- A. IDEMPOTENCY CHECK (Order ID)
    IF p_order_id IS NOT NULL AND p_order_id != 'unknown' THEN
        SELECT EXISTS (SELECT 1 FROM processed_webhooks WHERE order_id = p_order_id) INTO v_already_processed;
        IF v_already_processed THEN
            SELECT balance INTO v_new_balance FROM wallets WHERE user_id = p_user_id;
            RETURN json_build_object('success', true, 'message', 'Order already processed', 'idempotent', true, 'new_balance', COALESCE(v_new_balance, 0));
        END IF;
    END IF;

    -- B. IDEMPOTENCY CHECK (Event ID)
    IF EXISTS (SELECT 1 FROM processed_webhooks WHERE event_id = p_event_id) THEN
        SELECT balance INTO v_new_balance FROM wallets WHERE user_id = p_user_id;
        RETURN json_build_object('success', true, 'message', 'Event already processed', 'idempotent', true, 'new_balance', COALESCE(v_new_balance, 0));
    END IF;

    -- C. LOCK & REGISTER
    INSERT INTO processed_webhooks (event_id, payload, order_id)
    VALUES (p_event_id, p_raw_event, p_order_id)
    ON CONFLICT (event_id) DO NOTHING;

    -- D. VERIFY USER
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- E. UPDATE WALLET
    INSERT INTO wallets (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = wallets.balance + EXCLUDED.balance,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- F. LOG TRANSACTION
    INSERT INTO wallet_transactions (
        wallet_id, 
        amount, 
        type, 
        transaction_type,
        description, 
        status,
        reference_id
    )
    VALUES (
        p_user_id, 
        p_amount, 
        'PURCHASE',       -- Legacy compatibility
        'CREDIT',         -- New Standard
        'Coin Purchase (Order: ' || COALESCE(p_order_id, 'Direct') || ')', 
        'COMPLETED',
        p_order_id
    );

    RETURN json_build_object('success', true, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- =========================================================
-- PART 3: ADMIN & REVIEWS (Admin 2.0)
-- =========================================================

-- 3.1 Admin Analytics RPC
create or replace function public.get_admin_stats()
returns json as $$
declare
    total_users int;
    total_jobs int;
    total_reviews int;
    premium_users int;
    recent_users json;
    revenue numeric; 
begin
    -- 1. Basic Counts
    select count(*) into total_users from public.profiles;
    select count(*) into total_jobs from public.jobs;
    select count(*) into total_reviews from public.reviews;
    select count(*) into premium_users from public.subscriptions where status = 'ACTIVE' and plan_id <> 'FREE';
    
    -- 2. Revenue Simulation
    revenue := premium_users * 199; 

    -- 3. Recent Growth (Last 7 Days)
    select json_agg(t) into recent_users from (
        select 
            to_char(created_at, 'Mon DD') as date,
            count(*) as count
        from public.profiles
        where created_at > now() - interval '7 days'
        group by to_char(created_at, 'Mon DD'), date_trunc('day', created_at)
        order by date_trunc('day', created_at)
    ) t;

    return json_build_object(
        'total_users', total_users,
        'total_jobs', total_jobs,
        'total_reviews', total_reviews,
        'premium_users', premium_users,
        'revenue', revenue,
        'growth_chart', coalesce(recent_users, '[]'::json)
    );
end;
$$ language plpgsql security definer;


-- 3.2 Admin Broadcast RPC
create or replace function public.admin_broadcast_message(
    p_title text,
    p_message text,
    p_type text default 'SYSTEM'
)
returns json as $$
begin
    -- 1. Check if caller is admin
    if not exists (
        select 1 from public.user_roles 
        where user_id = auth.uid() and role = 'ADMIN'
    ) then
        return json_build_object('success', false, 'error', 'Unauthorized');
    end if;

    -- 2. Insert into notifications for ALL users
    insert into public.notifications (user_id, title, message, type)
    select id, p_title, p_message, p_type
    from public.profiles;

    return json_build_object('success', true, 'count', (select count(*) from public.profiles));

exception when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer;


-- 3.3 Reviews Tags Schema
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

DROP VIEW IF EXISTS public.view_reviews;

CREATE OR REPLACE VIEW public.view_reviews AS
SELECT 
    r.id,
    r.job_id,
    r.reviewer_id,
    r.reviewee_id,
    r.rating,
    r.comment,
    r.tags,
    r.created_at,
    p.name as reviewer_name,
    p.profile_photo as reviewer_photo,
    false as is_deleted
FROM public.reviews r
JOIN public.profiles p ON r.reviewer_id = p.id;

COMMIT;
