
# Architecture Improvement Plan

## 1. Security: Commission Logic Vulnerability (Critical)
**Current:** Client-side calculation of wallet balance and direct DB update in `chargeWorkerCommission`.
**Risk:** Malicious manipulation of wallet balance.
**Action:** Move logic to Supabase RPC `charge_worker_commission`.
   - Atomic transaction (check balance, deduct, log transaction).
   - Client only invokes the function.

## 2. Scalability: "Fetch All" Strategy
**Current:** `fetchJobs` loads all jobs/bids on mount.
**Risk:** Performance degradation and high data usage as data grows.
**Action:** Implement Server-Side Pagination & Filtering.
   - `fetchJobs(page, limit, filters)`.
   - Infinite scroll on Home feed.

## 3. Performance: Inefficient Real-time Sync
**Current:** `refreshJobs()` (full re-fetch) triggered on *any* DB change.
**Risk:** Server overload and client lag.
**Action:** Optimistic UI Updates & targeted re-fetching.
   - Use payload to update local state directly for simple inserts/updates.
   - Only re-fetch if necessary (e.g. complex data dependency).

## 4. Real-time Chat Fix (Immediate Priority)
**Issue:** Worker -> Poster messages not appearing instantaneously.
**Cause:** Likely missing or incorrect Real-time subscription for `chat_messages` table in `App.tsx` or `ChatInterface.tsx`.
**Action:**
   - Verify `App.tsx` global subscription includes `chat_messages`.
   - Ensure the subscription filter (if any) allows seeing messages *for the current user* or *for the active job*.
   - Debug the optimistic update vs. real-time event race condition.
