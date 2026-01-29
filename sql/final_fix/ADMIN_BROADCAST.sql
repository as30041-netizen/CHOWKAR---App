-- ==========================================
-- ADMIN BROADCAST
-- Description: Sends a notification to ALL users securely from Admin console.
-- ==========================================

create or replace function public.admin_broadcast_message(
    p_title text,
    p_message text,
    p_type text default 'SYSTEM'
)
returns json as $$
begin
    -- 1. Check if caller is admin (optional, handled by RLS on trigger usually, but good for RPC)
    if not exists (
        select 1 from public.user_roles 
        where user_id = auth.uid() and role = 'ADMIN'
    ) then
        return json_build_object('success', false, 'error', 'Unauthorized');
    end if;

    -- 2. Insert into notifications for ALL users
    -- WARNING: This can be heavy for millions of users. For MVP (few thousand), it's fine.
    -- Better approach for scale: Create 'announcements' table and fetch on client.
    -- But for < 10k users, direct insert is okay-ish.
    
    insert into public.notifications (user_id, title, message, type)
    select id, p_title, p_message, p_type
    from public.profiles;

    return json_build_object('success', true, 'count', (select count(*) from public.profiles));

exception when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer;
