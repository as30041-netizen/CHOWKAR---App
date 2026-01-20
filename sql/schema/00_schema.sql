-- ============================================================================
-- CHOWKAR MASTER SCHEMA (00_schema.sql)
-- Consolidated Database Structure - Jan 2026
-- ============================================================================

BEGIN;

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For search optimization

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('WORKER', 'POSTER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.job_status AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.bid_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. PROFILES (Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT, 
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    role public.user_role DEFAULT 'POSTER',
    rating NUMERIC DEFAULT 0,
    is_premium BOOLEAN DEFAULT FALSE,
    ai_usage_count INTEGER DEFAULT 0,
    bio TEXT,
    skills TEXT[],
    experience TEXT,
    profile_photo TEXT,
    verified BOOLEAN DEFAULT FALSE,
    push_token TEXT, -- FCM Token
    join_date BIGINT, 
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. JOBS
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poster_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    job_date DATE, -- Changed from TIMESTAMPTZ to DATE per recent fixes
    duration TEXT,
    budget INTEGER,
    status public.job_status DEFAULT 'OPEN',
    accepted_bid_id UUID, 
    bid_count INTEGER DEFAULT 0,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BIDS
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    message TEXT,
    status public.bid_status DEFAULT 'PENDING',
    negotiation_history JSONB DEFAULT '[]'::jsonb,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. WALLETS
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(user_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL, -- 'BONUS', 'PURCHASE', 'BID_FEE' etc. (Kept as TEXT for flexibility)
    type TEXT, -- Legacy column support if needed, otherwise rely on transaction_type
    description TEXT,
    reference_id UUID, -- order_id or job_id
    status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT,
    media_url TEXT,
    media_type TEXT,
    transcription TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CHAT STATES (Archive/Delete per user)
CREATE TABLE IF NOT EXISTS public.chat_states (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
    related_job_id UUID,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id),
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id),
    rating NUMERIC NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    tags TEXT[],
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. USER BLOCKS
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- 12. AUXILIARY TABLES
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    id TEXT PRIMARY KEY,
    event_id TEXT, -- Legacy support
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_job_visibility (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    is_hidden BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    feature TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. INDEXES (Performance)
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_poster ON public.jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON public.jobs(category) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_jobs_status_poster ON public.jobs(status, poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_search_trgm ON public.jobs USING gin (title gin_trgm_ops, description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bids_job_worker ON public.bids(job_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids(status);

CREATE INDEX IF NOT EXISTS idx_messages_job ON public.chat_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.chat_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_job_created ON public.chat_messages(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_blocks_both ON public.user_blocks(blocker_id, blocked_id);

COMMIT;
