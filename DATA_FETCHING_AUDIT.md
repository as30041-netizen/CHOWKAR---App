# Data Fetching Audit & Improvement Plan

## Executive Summary
The current application architecture prioritizes "correctness and ease of sync" over performance. It eagerly fetches all data (Jobs + All Bids + Full Details) to ensure the UI is always responsive. While this works for < 100 jobs, it will degrade rapidly as the dataset grows. 

**Key Issue:** Network "Waterhosing". We are downloading full job descriptions, images, and every single bid for every job displayed in the feed, whether the user interacts with it or not.

## Audit Findings

### 1. Critical Over-Fetching in `JobContextDB`
*   **The Problem:** `fetchJobs` performs a heavy query:
    1.  Selects `*` from `jobs` (includes potentially large `description` and `image` columns).
    2.  Selects `*` from `bids` for ALL fetched jobs at once.
    3.  Joins them in memory.
*   **Impact:** If 20 jobs have 5 bids each, we fetch 20 Job objects + 100 Bid objects on load. 
*   **Visual Evidence:** `JobCard` primarily needs `title`, `budget`, `location`, `status`, and `createdAt`. It *rarely* needs the full `bids` array unless showing "Worker Status".

### 2. Global Realtime Subscriptions
*   **The Problem:** The app opens `postgres_changes` channels for `jobs` (all events), `bids` (all events), and `chat_messages` (all events in public schema).
*   **Impact:** 
    *   Every time a job description changes, *every* online user downloads the new text.
    *   Every time a bid is placed, *every* user gets the signal (even if they aren't looking at that job).
*   **Security/Privacy:** While Row Level Security (RLS) protects the *data* access, the *subscription* might still be firing frequent "empty" or filtered updates, consuming battery and connection limits.

### 3. Component Dependencies
*   **The Problem:** `JobDetailsModal` relies entirely on the `job` object passed from the parent list.
*   **Consequence:** We naturally feel forced to fetch full data in the List View because we know the Detail View might be opened instantly.

---

## Improvement Plan

### Phase 1: Surgical Data Fetching (High Impact, Low Risk)
*Goal: Reduce Feed payload size by 80%.*

1.  **Create `get_job_feed` RPC**:
    *   Returns only summary fields: `id`, `title`, `budget`, `location`, `created_at`, `status`, `category`, `poster_id`, `poster_name`, `poster_photo`.
    *   Calculates `bid_count` on the server side (avoid fetching bid rows).
    *   Returns `my_bid_status` (if the calling user has bid).
    *   *Exclude*: `image` (unless thumbnail is tiny), `description` (send truncated version), complete `bids` list.

2.  **Refactor `JobCard`**:
    *   Stop determining "My Bid" status by iterating arrays. Use the pre-calculated `my_bid_status`.

3.  **Update `JobDetailsModal`**:
    *   Accept `jobId` and `previewData`.
    *   On mount, trigger `fetchJobDetails(jobId)` to get the full description, full resolution images, and relevant bids.

### Phase 2: Optimized Realtime (Medium Impact)
*Goal: Stop the "Noise".*

1.  **Scoped Subscriptions**:
    *   **Feed**: Listen to `INSERT` on `jobs` (New jobs only). Ignore `UPDATE` unless necessary.
    *   **My Jobs (Poster)**: Subscribe to `bids` where `job_id` is one of *my* jobs.
    *   **My Applications (Worker)**: Subscribe to `jobs` status changes where `id` is in my bid list.
    *   *Implementation*: Use Supabase Channels with precise filters (`filter: 'poster_id=eq.${userId}'`).

### Phase 3: Pagination & Caching (Long Term)
1.  **Infinite Scroll**: We already have basic pagination (`range(offset, limit)`). Ensure this is strictly enforced (limit 20).
2.  **React Query / SWR**: Move away from `Context` based state management for data. Use a library like TanStack Query to handle caching, background refetching, and deduping.

## Immediate Action Items (Recommended)

1.  **Modify `fetchJobs`**: Select specific columns instead of `*`.
    ```typescript
    .select('id, title, budget, location, created_at, status, category, poster_id, poster_name, poster_photo, job_date, duration')
    ```
2.  **Modify `fetchJobs` logic**: Do NOT fetch bids for all jobs. Only fetch `my_bids` for the current user to update button states.

3.  **Create `JobService.fetchJobDetails(id)`**: A specific function to get the "heavy" data when the user actually clicks.
