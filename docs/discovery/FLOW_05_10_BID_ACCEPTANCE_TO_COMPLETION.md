# Flow 5-10: Bid Acceptance to Job Completion

**Last Updated**: 2025-12-21  
**Status**: ✅ AUDITED

---

## Overview

This document covers the complete lifecycle from bid review through job completion:
- **Flow 5**: Bid Review & Negotiation (Poster)
- **Flow 6**: Counter-Offer Response (Worker)
- **Flow 7**: Bid Acceptance & Job Start
- **Flow 8**: Chat Unlock (Worker Payment)
- **Flow 9**: Chat & Communication
- **Flow 10**: Job Completion & Reviews

---

## Flow 5: Bid Review & Negotiation (Poster) ✅

### 5.1 How does poster view bids on their job?

**Answer**: Through `ViewBidsModal` component
- Accessed via "View Bids" button on JobCard/JobDetailsModal
- Shows all bids sorted by newest first
- Real-time updates via Supabase postgres_changes subscription

**Files**: `components/ViewBidsModal.tsx`

### 5.2 What worker info is visible?

- Worker name
- Worker photo (or placeholder UserCircle icon)
- Worker rating (star display)
- Bid amount
- Bid message (quoted style)
- Bid timestamp (relative time)
- "NEW" badge for bids < 1 hour old

### 5.3 Can poster accept a bid directly?

**Yes** - "Accept" button visible for PENDING bids
- Calls `accept_bid` RPC function
- No poster fee charged (poster already paid when posting)

### 5.4 Can poster reject a bid?

**Yes** - Red "✕" button for explicit rejection
- Deletes bid from database
- Sends friendly notification to worker (doesn't mention "rejected")
- Message: "The employer chose a different worker..."

### 5.5 Can poster counter-offer?

**Yes** - "Counter" button opens CounterModal
- Pre-fills with current bid amount
- Allows poster to propose new amount
- Updates bid's negotiationHistory

### 5.6 How is counter-offer communicated?

- Database trigger `notify_on_counter_offer` sends notification
- Worker sees in-app notification
- Push notification (if FCM configured)

### 5.7 Negotiation history storage

**Format**: `negotiationHistory` JSONB array
```json
[
  { "amount": 1500, "by": "WORKER", "timestamp": 1703123456000 },
  { "amount": 1200, "by": "POSTER", "timestamp": 1703123567000 },
  { "amount": 1300, "by": "WORKER", "timestamp": 1703123678000 }
]
```

### 5.8 Maximum negotiation rounds?

**Answer**: No limit - parties can counter indefinitely until acceptance/rejection

### 5.9 Can poster accept after counter-offering?

**Yes** - Accept button remains available on PENDING bids regardless of negotiation history

### 5.10 Notifications during negotiation

| Event | Recipient | Notification |
|-------|-----------|--------------|
| New bid placed | Poster | "New Bid" via DB trigger |
| Counter from poster | Worker | "Counter Offer" via DB trigger |
| Counter from worker | Poster | "Counter Offer" via DB trigger |

---

## Flow 6: Counter-Offer Response (Worker) ✅

### 6.1 How is worker notified?

- In-app notification with title "Counter Offer"
- Push notification (if FCM)
- Badge on notification bell

### 6.2 Where does worker view counter-offers?

**Three locations**:
1. JobCard - shows "Counter: ₹X" with Accept/Decline/Counter options
2. JobDetailsModal - full negotiation history view
3. Notifications panel - links to job

### 6.3 Worker options for counter-offer?

- **Accept** - Agrees to poster's amount (does NOT trigger auto-acceptance)
- **Decline** - Withdraws bid
- **Counter** - Proposes new amount

### 6.4 Can worker counter the counter?

**Yes** - Counter button available, adds to negotiationHistory

### 6.5 What happens when worker accepts counter?

```
[Worker accepts] → handleWorkerReplyToCounter(jobId, bidId, 'ACCEPT', amount)
                 → Updates bid amount to counter amount
                 → Notifies poster: "Counter Accepted"
                 → Poster must still click "Accept Bid" to proceed
```

### 6.6 What happens when worker rejects counter?

```
[Worker declines] → Confirmation dialog
                  → Bid is withdrawn (deleted)
                  → Poster notified
```

### 6.7 Negotiation history visible to worker?

**Yes** - Same display in JobDetailsModal showing all offers with timestamps

### 6.8 Negotiation history format

Same as Flow 5.7 - JSONB array with amount, by (role), timestamp

---

## Flow 7: Bid Acceptance & Job Start ✅

### 7.1 What happens when poster accepts?

```
[Accept Bid] → supabase.rpc('accept_bid', {
                p_job_id, p_bid_id, p_poster_id, 
                p_worker_id, p_amount, p_poster_fee: 0
              })
            → Updates bid status to ACCEPTED
            → Rejects all other PENDING bids
            → Sets job status to IN_PROGRESS
            → Sets job.accepted_bid_id
            → DB trigger notifies worker
```

### 7.2 Does accepting auto-reject others?

**Yes** - `accept_bid` RPC does:
```sql
UPDATE bids
SET status = 'REJECTED', updated_at = NOW()
WHERE job_id = p_job_id AND id != p_bid_id AND status = 'PENDING';
```

### 7.3 Job status after acceptance?

**IN_PROGRESS** - Set by RPC function

### 7.4 Worker notification on acceptance?

- Handled by database trigger `notify_on_bid_accept`
- Worker sees: "You Got the Job!" notification

### 7.5 Rejected bidders notified?

**Yes** - DB trigger sends to other bidders:
"Job Update - Another worker selected"

### 7.6 Can poster undo acceptance?

**No direct undo** - Would need to:
1. Cancel job with refund
2. Re-post the job

### 7.7 RPC function used?

**`accept_bid`** in `CREATE_ALL_RPC_FUNCTIONS.sql` (lines 57-132)

### 7.8 Database changes on acceptance?

| Table | Column | Change |
|-------|--------|--------|
| bids | status | 'ACCEPTED' for winner |
| bids | status | 'REJECTED' for others |
| jobs | status | 'IN_PROGRESS' |
| jobs | accepted_bid_id | Winner's bid ID |

---

## Flow 8: Chat Unlock (Worker Payment) ✅

### 8.1 When can worker start chatting?

**After accepted bid + connection fee paid**

### 8.2 Connection/chat unlock fee?

- Configurable via `app_config` table
- Default: ₹20
- Key: `connection_fee`

### 8.3 Payment collection flow?

```
[Worker clicks Chat] 
    → Check bids.connection_payment_status
    ↓ if NOT 'PAID'
    → Check wallet balance
    ↓ if sufficient
    → Deduct from wallet → Update bid → Open chat
    ↓ if insufficient
    → Show PaymentModal (Razorpay)
    → On success → Update bid → Open chat
```

**Code Location**: `App.tsx` lines 305-360

### 8.4 After successful payment?

1. `bids.connection_payment_status` = 'PAID'
2. `bids.connection_payment_id` = Razorpay ID (if applicable)
3. Chat interface opens
4. Poster notified via DB trigger

### 8.5 Payment status storage?

**Yes** - `bids` table columns:
- `connection_payment_status`: 'PENDING' | 'PAID'
- `connection_payment_id`: Razorpay payment ID

### 8.6 Chat access before payment?

**No** - Worker sees PaymentModal until fee paid

### 8.7 What does poster see before worker pays?

- Poster can access chat (no payment required)
- Message: "Waiting for worker to unlock chat"

### 8.8 Poster notification on chat unlock?

Handled by DB trigger on `bids.connection_payment_status` change

### 8.9 Refund policy?

**No automatic refund** - Connection fee is non-refundable

---

## Flow 9: Chat & Communication ✅

### 9.1 Who can chat?

- **Poster** ↔ **Accepted Worker** only
- Both parties for accepted/in-progress jobs

### 9.2 Chat scope?

**Per-job** - Each job has its own chat thread

### 9.3 Message storage?

**`messages` table**:
- `id`, `job_id`, `sender_id`, `receiver_id`, `text`
- `is_read`, `created_at`, `deleted_at`

### 9.4 Translation support?

**Yes** - Via Gemini AI
- Button on each message
- Stores translated text in message object
- Limited by free AI usage quota

### 9.5 Real-time messaging?

**Yes** - Supabase postgres_changes subscription
- Channel: `messages_${jobId}`
- Events: INSERT, UPDATE, DELETE

### 9.6 Message deletion?

**Soft delete** - Sets `deleted_at` timestamp
- UI shows "Message deleted" 
- Actually hidden from view

### 9.7 Chat after job completion?

**Remains accessible** - No restrictions on completed jobs

### 9.8 Unread message count?

- Calculated per-job
- Badge shown on chat list and navigation

### 9.9 New message notifications?

- DB trigger `notify_on_new_message`
- Push via FCM if configured

### 9.10 Security - unpaid worker access?

**No access** - `connection_payment_status` check gates chat access

---

## Flow 10: Job Completion & Reviews ✅

### 10.1 Who marks job complete?

**Poster** - Via chat interface "Mark Complete" button

### 10.2 Completion verification?

**Manual confirmation** - No automated verification
- Poster clicks button → Confirmation → Done

### 10.3 Worker "Work Ready" status?

**Not implemented** - Direct completion by poster

### 10.4 After completion?

1. Job status → 'COMPLETED'
2. Confetti animation!
3. ReviewModal opens for poster to rate worker
4. Worker notified via DB trigger
5. Chat closes

### 10.5 Review submission?

```javascript
supabase.from('reviews').insert({
  reviewer_id: user.id,
  reviewee_id: workerId,
  job_id: jobId,
  rating: 1-5,
  comment: optional,
  tags: null
})
```

### 10.6 Does worker review poster?

**Prompt on next login** - After receiving completion notification
- Worker sees "Rate your experience" prompt
- Opens ReviewModal for poster rating

### 10.7 Rating update?

**DB trigger** - Automatically recalculates average rating in `profiles` table

### 10.8 Review validation?

- Rating required (1-5 stars)
- Comment optional (max implied by textarea)

---

## Database Schema Summary

### Key Tables

```sql
-- bids
id, job_id, worker_id, amount, message, status, 
negotiation_history, connection_payment_status, 
connection_payment_id, created_at, updated_at

-- jobs  
id, poster_id, title, description, status, budget,
accepted_bid_id, created_at, updated_at

-- messages
id, job_id, sender_id, receiver_id, text, 
is_read, created_at, deleted_at

-- reviews
id, reviewer_id, reviewee_id, job_id, 
rating, comment, tags, created_at
```

### RPC Functions

| Function | Purpose |
|----------|---------|
| `accept_bid` | Accept bid, reject others, start job |
| `process_transaction` | Wallet credits/debits |
| `soft_delete_chat_message` | Delete message |
| `mark_messages_read` | Mark messages as read |

---

## Related Files

| File | Purpose |
|------|---------|
| `components/ViewBidsModal.tsx` | Bid review and accept/reject/counter UI |
| `components/CounterModal.tsx` | Counter offer input |
| `components/ChatInterface.tsx` | Full chat UI |
| `components/ChatListPanel.tsx` | Chat list/inbox |
| `components/ReviewModal.tsx` | Rating submission |
| `components/PaymentModal.tsx` | Razorpay integration |
| `App.tsx` | Core handlers for all flows |
| `CREATE_ALL_RPC_FUNCTIONS.sql` | All database functions |

---

## Identified Issues & Fixes Required

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| ReviewModal missing dark mode | Low | ⚠️ NEEDS FIX | Hard-coded white theme |
| ReviewModal missing Hindi translations | Low | ⚠️ NEEDS FIX | All English text |
| Comment textarea missing maxLength | Low | ⚠️ NEEDS FIX | Should limit input |
| No worker-initiated review prompt | Medium | ✅ Designed | Worker reviews after completion |

---

## Flow Diagrams

### Complete Bid-to-Completion Flow

```
[POSTER POSTS JOB] ────────────────────────────────────────────┐
         ↓                                                     │
[WORKERS SEE JOB] → [Submit Bid] → [DB] → [Notify Poster]     │
         ↓                                                     │
[POSTER VIEWS BIDS IN ViewBidsModal]                          │
         ↓                                                     │
    ┌─── Accept ───┐                                          │
    │              │                                          │
    ↓              ↓                                          │
Counter ──→    [accept_bid RPC]                               │
    ↓              ↓                                          │
Worker     ┌───────────────────┐                              │
Responds   │ - Bid ACCEPTED    │                              │
    │      │ - Others REJECTED │                              │
    ↓      │ - Job IN_PROGRESS │                              │
Accept     │ - Notify Worker   │                              │
    │      └───────────────────┘                              │
    │              ↓                                          │
    └─────→ [WORKER PAYS CONNECTION FEE]                      │
                   ↓                                          │
           [CHAT UNLOCKED]                                    │
                   ↓                                          │
           [COMMUNICATION VIA ChatInterface]                  │
                   ↓                                          │
           [POSTER MARKS COMPLETE]                            │
                   ↓                                          │
           [ReviewModal - Rate Worker]                        │
                   ↓                                          │
           [Worker Prompted to Rate Poster]                   │
                   ↓                                          │
           [JOB COMPLETED ✅]                                 │
```

---

## Audit Completed: 2025-12-21
