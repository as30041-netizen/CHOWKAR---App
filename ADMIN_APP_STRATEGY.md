# Admin App Strategy for Chowkar

## Overview
To effectively manage the Chowkar platform, an administrative interface is required. This document outlines the recommended changes and strategy for building the Admin App.

## 1. Authentication & Roles
- **Current State:** The app has `WORKER` and `POSTER` roles.
- **Change Implemented:** Added `ADMIN` to `UserRole` in `types.ts`.
- **Database Requirement:**
    - Ensure the `users` (or `profiles`) table in Supabase has a `role` column that supports 'ADMIN'.
    - **RLS Policies:** Update Row Level Security (RLS) policies in Supabase to allow users with `role = 'ADMIN'` to select/update/delete rows in *all* tables (`jobs`, `users`, `reports`, etc.).

## 2. Infrastructure Recommendation
Instead of building a custom Admin App from scratch, we recommend using a low-code internal tool framework connected to your Supabase database. This saves weeks of development time.

**Recommended Tools:**
1.  **Refine.js (Highly Recommended):** A React-based framework specifically for building admin panels. It has excellent Supabase integration.
    - *Pros:* Fully customizable code, runs on your own infrastructure/Vercel.
    - *Cons:* Requires some dev setup.
2.  **Appsmith / Retool:** Drag-and-drop builders.
    - *Pros:* Very fast to build.
    - *Cons:* Can get expensive at scale or hit limitations.
3.  **Supabase Dashboard:**
    - *Pros:* Free, built-in.
    - *Cons:* Not a user-friendly custom admin UI; dangerous for non-technical admins.

**Recommendation:** Build a separate **Refine.js** project in a `chowkar-admin` repo.

## 3. Key Admin Features & Schema Requirements

### A. User Management
- **Feature:** View all users, ban suspicious users, verify identities.
- **Schema:** `profiles` table needs `is_banned` (boolean) and `verification_status` (enum: 'none', 'pending', 'verified', 'rejected').

### B. Content Moderation (Jobs)
- **Feature:** Delete spam (illegal) jobs, edit categories.
- **Schema:** `jobs` table is sufficient. RLS needs to allow admin delete.

### C. Dispute Resolution & Reports
- **Feature:** View user reports (from the new "Report User" modal).
- **Schema:** Create a `user_reports` table.
    ```sql
    create table user_reports (
      id uuid default uuid_generate_v4() primary key,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null,
      reporter_id uuid references auth.users not null,
      reported_id uuid references auth.users not null,
      job_id uuid references jobs,
      reason text not null,
      description text,
      status text default 'PENDING' check (status in ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED')),
      admin_notes text
    );
    alter table user_reports enable row level security;
    create policy "Admins can view all reports" on user_reports 
      for select using (auth.jwt() ->> 'role' = 'ADMIN' or (select role from profiles where id = auth.uid()) = 'ADMIN');
    create policy "Users can insert reports" on user_reports 
      for insert with check (auth.uid() = reporter_id);
    ```

### D. Analytics
- **Feature:** Track active jobs, total volume, commission revenue.
- **Implementation:** Create SQL Views in Supabase for aggregated stats (`daily_active_users`, `revenue_stats`) to make fetching fast for the admin dashboard.

## 4. Next Steps
1.  **Execute SQL:** Run the SQL to create `user_reports` and update RLS policies.
2.  **Initialize Admin Project:** `npm create refine-app@latest chowkar-admin`.
3.  **Connect:** Use `supabaseClient` in the admin app with the same project URL but a `service_role` key (backend) or strict RLS + Admin user login (frontend).
