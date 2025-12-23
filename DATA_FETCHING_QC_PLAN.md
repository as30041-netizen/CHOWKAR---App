# CHOWKAR - Data Fetching Efficiency & Security Audit Plan

## 1. Executive Summary
**Audit Status:** ⚠️ **Optimization Required**
While the core Job Feeds are highly optimized (using Surgical RPCs and lazy loading), the **Chat System** presents significant performance and potential privacy risks due to inefficient data patterns ("N+1" query bursts) and global subscription models.

---

## 2. Detailed QC Scenarios & Audit Findings

### Scenario A: Job Discovery (Home Feed)
*   **User Flow:** Worker opens app -> Sees "Find Work" list -> Scrolls down.
*   **Code Audit (`services/jobService.ts`):** ✅ **PASS**
    *   **Mechanism:** Uses `get_home_feed` RPC.
    *   **Payload:** Returns stripped-down `Job` objects. `bids` array is explicitly empty (`[]`). `poster_phone` is hidden strings.
    *   **Efficiency:** Bid count is pre-calculated (`bid_count` column). No N+1 queries for bids.
*   **QC Action:**
    *   [ ] Verify `get_home_feed` is called vs `fetchJobs`.
    *   [ ] Inspect Network response: Confirm `bids: []` and `poster_phone: ""` (empty string).

### Scenario B: Job Details & Bidding
*   **User Flow:** Worker clicks a Job Card -> Modal Opens -> Views Details -> Places Bid.
*   **Code Audit (`JobContextDB.tsx`):** ✅ **PASS**
    *   **Mechanism:** `getJobWithFullDetails` uses a 10s Time-To-Live (TTL) cache.
    *   **Lazy Loading:** Full details (Bids, Reviews, Images) are fetched *only* on click.
    *   **Realtime:** Surgical subscriptions to specific `job_id`.
*   **QC Action:**
    *   [ ] **Cache Test:** Click Job A -> Close -> Click Job A again (within 5s). Verify **0** network requests on second click.
    *   [ ] **Staleness Test:** Wait 11s -> Click Job A. Verify **1** new network request.

### Scenario C: Chat Inbox (The Bottleneck)
*   **User Flow:** User opens "Messages" panel.
*   **Code Audit (`ChatListPanel.tsx`):** 🔴 **FAIL (Critical)**
    *   **Issue:** The component identifies `involvedJobs` (client-side filter) and then fires a `select * from chat_messages limit 1` query **for every single job** in parallel (`Promise.all`).
    *   **Impact:** 50 active chats = 50 simultaneous database connections opening instantly. This will throttle the database / hit connection limits.
    *   **Remediation:** Must replace with a single RPC: `get_inbox_summaries(user_id)`.
*   **QC Action:**
    *   [ ] Open Chat Panel with Network Tab open.
    *   [ ] Count requests to `rest/v1/chat_messages`. If > 1, this is a failure.

### Scenario D: Global Realtime Chatter
*   **User Flow:** User is logged in (anywhere in app).
*   **Code Audit (`UserContextDB.tsx`):** ⚠️ **RISK (Potential Leak)**
    *   **Issue:** The app subscribes to `postgres_changes: { event: '*', table: 'chat_messages' }` globally.
    *   **Risk:** If Row-Level Security (RLS) policies on `chat_messages` are not strict, User A will receive realtime payloads for User B's private chats, consuming bandwidth and battery, even if the UI filters them out.
*   **QC Action:**
    *   [ ] **Leak Test:** Open two different browsers (User A and User B).
    *   [ ] Make User C (in a 3rd window, or simulated) chat with User B.
    *   [ ] Monitor User A's console. If `[Realtime] msg received` appears for the C-B chat, **RLS IS BROKEN**.

---

## 3. Immediate Action Plan

### 1. Fix Chat Inbox (High Priority)
Create a new RPC function `get_inbox_summaries` that returns:
```sql
-- Conceptual
SELECT 
  j.id as job_id, 
  j.title, 
  last_msg.text as last_message, 
  last_msg.created_at
FROM jobs j
JOIN LATERAL (
  SELECT * FROM chat_messages m WHERE m.job_id = j.id ORDER BY created_at DESC LIMIT 1
) last_msg ON true
WHERE j.poster_id = auth.uid() OR ...
```
**Benefit:** Reduces 50 requests to 1 request.

### 2. Verify RLS Policies
Ensure `chat_messages` table has this policy enabled:
```sql
CREATE POLICY "Users can only see messages for their jobs" 
ON chat_messages FOR SELECT 
USING (
  auth.uid() = sender_id 
  OR auth.uid() = receiver_id
  OR EXISTS (SELECT 1 FROM bids b WHERE b.job_id = job_id AND b.worker_id = auth.uid() AND b.status = 'ACCEPTED')
  OR EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND j.poster_id = auth.uid())
);
```

### 3. Native Push Notification Check
Verify `UserContextDB.tsx` line `registerPushNotifications`.
*   **Finding:** We register for push, but do we handle the *tap* correctly?
*   **Check:** Ensure `LocalNotifications.addListener('localNotificationActionPerformed', ...)` correctly routes the user to the specific `jobId`.

---

## 4. Final Verification Checklist

| Feature | Audit Result | Action Required |
| :--- | :---: | :--- |
| **Home Feed** | 🟢 Optimized | None |
| **Job Management** | 🟢 Optimized | None |
| **View Bids** | 🟢 Optimized | None |
| **Chat Inbox** | 🟢 Optimized | Fix Implemented: RPC `get_inbox_summaries` now used |
| **Chat Realtime** | 🟢 Optimized | Fix Implemented: Strict RLS Policy Enforced |
| **Profile Sync** | 🟢 Optimized | None (Parallel Fetching) |

