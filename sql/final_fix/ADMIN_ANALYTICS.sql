-- ==========================================
-- ADMIN ANALYTICS
-- Description: Returns aggregated stats for the Admin Dashboard.
-- ==========================================

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
    
    -- 2. Mock Revenue (We don't store payment amounts directly in a queryable way easily yet, simulating based on subscriptions)
    -- select count(*) * 199 into revenue from public.subscriptions where plan_id <> 'FREE';
    -- For now, just return 0 or a placeholder if no real payment ledger
    revenue := premium_users * 199; 

    -- 3. Recent Growth (Last 7 Days) - JSON Array
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
