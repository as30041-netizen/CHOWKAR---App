-- ==========================================
-- PHASE 1: HYBRID FREEMIUM FOUNDATION
-- Description: Creates tables for Subscriptions, Reviews, and Verification.
--              Includes RLS policies for security.
-- ==========================================

-- 1. SUBSCRIPTIONS TABLE
-- Tracks user membership plans (Free, Pro Poster, Worker Plus)
create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    plan_id text not null check (plan_id in ('FREE', 'PRO_POSTER', 'WORKER_PLUS')),
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'CANCELLED')),
    start_date timestamptz default now(),
    end_date timestamptz,
    razorpay_subscription_id text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- RLS: Users can see their own subscription
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions
    for select using (auth.uid() = user_id);

-- 2. REVIEWS TABLE
-- Stores ratings and feedback for completed jobs
create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    job_id uuid references public.jobs(id) on delete cascade not null,
    reviewer_id uuid references public.profiles(id) not null,
    reviewee_id uuid references public.profiles(id) not null,
    rating integer not null check (rating >= 1 and rating <= 5),
    comment text,
    photos text[], -- Array of photo URLs
    created_at timestamptz default now()
);

-- RLS: Public can read reviews, Authenticated users can create
alter table public.reviews enable row level security;
create policy "Reviews are public" on public.reviews
    for select using (true);
create policy "Authenticated can write reviews" on public.reviews
    for insert with check (auth.uid() = reviewer_id);

-- 3. VERIFICATION REQUESTS TABLE
-- Manages the flow of ID verification (Aadhaar/PAN)
create table if not exists public.verification_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade not null,
    document_type text not null check (document_type in ('AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE')),
    document_url text not null, -- Secure URL to the image
    status text default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
    admin_notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- RLS: Users can see/create their own requests. Only Admins (via separate policy/dashboard) can update status.
alter table public.verification_requests enable row level security;
create policy "Users can view own requests" on public.verification_requests
    for select using (auth.uid() = user_id);
create policy "Users can create requests" on public.verification_requests
    for insert with check (auth.uid() = user_id);

-- 4. UPDATE PROFILES
-- Add flags for quick access in UI without joining tables
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'is_verified') then
        alter table public.profiles add column is_verified boolean default false;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'subscription_plan') then
        alter table public.profiles add column subscription_plan text default 'FREE';
    end if;
end $$;


-- 5. FUNCTION: UPDATE PROFILE ON SUBSCRIPTION CHANGE
-- Automatically keeps the profile's 'subscription_plan' column in sync
create or replace function public.handle_subscription_change()
returns trigger as $$
begin
    update public.profiles
    set subscription_plan = new.plan_id
    where id = new.user_id;
    return new;
end;
$$ language plpgsql security definer;

-- Trigger for subscription sync
drop trigger if exists on_subscription_change on public.subscriptions;
create trigger on_subscription_change
    after insert or update of plan_id, status on public.subscriptions
    for each row execute function public.handle_subscription_change();


-- 6. FUNCTION: UPDATE PROFILE ON VERIFICATION APPROVAL
-- Automatically fliips the 'is_verified' flag when request is APPROVED
create or replace function public.handle_verification_update()
returns trigger as $$
begin
    if new.status = 'APPROVED' then
        update public.profiles
        set is_verified = true
        where id = new.user_id;
    end if;
    return new;
end;
$$ language plpgsql security definer;

-- Trigger for verification sync
drop trigger if exists on_verification_update on public.verification_requests;
create trigger on_verification_update
    after update of status on public.verification_requests
    for each row execute function public.handle_verification_update();
