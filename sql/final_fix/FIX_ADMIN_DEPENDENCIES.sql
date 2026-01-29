-- ==========================================
-- FIX ADMIN 2.0 DEPENDENCIES
-- Description: Creates missing tables and fixes RPC functions
-- ==========================================

BEGIN;

-- 1. Create user_roles table (required for admin authorization)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('ADMIN', 'MODERATOR', 'USER')),
    granted_at timestamptz DEFAULT now(),
    granted_by uuid REFERENCES public.profiles(id),
    UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Only admins can grant roles (enforced via RPC)
CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- 2. Grant yourself admin role (replace with your actual user ID or email)
-- You can find your user_id from the profiles table
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'ADMIN' FROM public.profiles WHERE email = 'your-email@example.com'
-- ON CONFLICT DO NOTHING;

-- For the current session user (run this after uncommenting):
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT auth.uid(), 'ADMIN'
-- WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'ADMIN');


-- 3. Re-create Admin Stats RPC (in case it didn't execute properly)
DROP FUNCTION IF EXISTS public.get_admin_stats();

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json AS $$
DECLARE
    total_users int;
    total_jobs int;
    total_reviews int;
    premium_users int;
    recent_users json;
    revenue numeric; 
BEGIN
    -- 1. Basic Counts
    SELECT count(*) INTO total_users FROM public.profiles;
    SELECT count(*) INTO total_jobs FROM public.jobs;
    SELECT count(*) INTO total_reviews FROM public.reviews;
    
    -- Count active premium subscriptions
    SELECT count(*) INTO premium_users 
    FROM public.profiles 
    WHERE subscription_plan IN ('PRO_POSTER', 'WORKER_PLUS')
      AND (subscription_expiry IS NULL OR subscription_expiry > now());
    
    -- 2. Revenue Simulation (₹199 per premium user)
    revenue := premium_users * 199; 

    -- 3. Recent Growth (Last 7 Days)
    SELECT json_agg(t) INTO recent_users FROM (
        SELECT 
            to_char(created_at, 'Mon DD') as date,
            count(*) as count
        FROM public.profiles
        WHERE created_at > now() - interval '7 days'
        GROUP BY to_char(created_at, 'Mon DD'), date_trunc('day', created_at)
        ORDER BY date_trunc('day', created_at)
    ) t;

    RETURN json_build_object(
        'total_users', total_users,
        'total_jobs', total_jobs,
        'total_reviews', total_reviews,
        'premium_users', premium_users,
        'revenue', revenue,
        'growth_chart', coalesce(recent_users, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Re-create Admin Broadcast RPC
DROP FUNCTION IF EXISTS public.admin_broadcast_message(text, text, text);

CREATE OR REPLACE FUNCTION public.admin_broadcast_message(
    p_title text,
    p_message text,
    p_type text DEFAULT 'SYSTEM'
)
RETURNS json AS $$
BEGIN
    -- 1. Check if caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'ADMIN'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin role required');
    END IF;

    -- 2. Insert into notifications for ALL users
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT id, p_title, p_message, p_type
    FROM public.profiles;

    RETURN json_build_object('success', true, 'count', (SELECT count(*) FROM public.profiles));

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
