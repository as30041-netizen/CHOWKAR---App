# Bid Counter & Workflow Audit Plan

> **Scope**: Comprehensive audit of all bidding, counter-offer, and negotiation workflows between Workers and Posters.
> **Objective**: Identify logic errors, UI inconsistencies, and data integrity issues, specifically focusing on the recent "Turn Indicator" bugs and notification deduplication.

## 1. Core Workflows to Audit

### A. Basic Bidding
1. **Place Bid**: Worker places a bid (Amount > 0, optional message).
2. **Duplicate Check**: Worker tries to bid again on the same job (Should be blocked).
3. **Withdraw Bid**: Worker withdraws a pending bid.
4. **Employer View**: Poster sees the new bid with correct amount/message.

### B. Counter-Offer Cycles
**Scenario 1: Poster Initiates Counter**
1. Poster sends counter offer (e.g., ₹500 -> ₹400).
2. Worker receives notification.
3. Worker sees "Poster Countered: ₹400" in JobCard.
4. Worker can: Accept / Reject / Counter again.

**Scenario 2: Worker Initiates Counter**
1. Worker sends counter offer (e.g., ₹400 -> ₹450).
2. Poster receives notification.
3. Poster sees "Worker Countered: ₹450".
4. Poster can: Accept / Reject / Counter again.

**Scenario 3: Acceptance**
1. Party A accepts Party B's counter.
2. Bid status becomes `ACCEPTED`.
3. Notifications sent to both.
4. Chat unlocked (if applicable).

### C. UI State & Feedback (The "Turn Indicator" Issue)
*Focus Area*: `JobCard.tsx` logic.
- Verify `isWorkerTurn` and `isPosterTurn` logic accurately reflects the *next* action required.
- **Bug Hunt**: Does Poster see "Worker countered - Your turn" immediately after *Poster* sends a counter? (Self-flagging error).
- **Bug Hunt**: Does `hasNewCounter` flag get cleared correctly?

## 2. Components Under Review

### Frontend
- **`components/JobCard.tsx`**: Main logic for displaying status badges and action buttons.
- **`components/BidModal.tsx`**: Initial bid placement.
- **`components/CounterModal.tsx`** (or inline counter in JobCard): Handling counter input.
- **`components/ViewBidsModal.tsx`**: Poster's list of bids.

### Backend (Supabase)
- **Table**: `bids`
    - `negotiation_history` (JSONB): Crucial for tracking turns.
    - `status`: `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`.
- **Triggers**:
    - `on_bid_created_notify`
    - `on_bid_updated` (handling counters)
- **RPC Functions**:
    - `update_bid_status`
    - `add_negotiation_entry`

## 3. Detailed Verification Checklist

### Phase 1: Manual UI Testing (Requires 2 Accounts)

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| **1.1** | **Poster Counter Flow** | 1. Poster views a bid.<br>2. Poster clicks "Counter".<br>3. Enter amount & send. | - Poster sees "Waiting for response"<br>- Worker sees "Poster Countered"<br>- **NO** "Your turn" msg for Poster. | |
| **1.2** | **Worker Response** | 1. Worker views counter.<br>2. Worker accepts. | - Bid marked ACCEPTED.<br>- Job status updates (if hired). | |
| **1.3** | **Worker Counter Flow** | 1. Worker counters a bid.<br>2. Check notifications. | - Poster gets *one* notification.<br>- Worker gets *zero* notifications.<br>- Poster sees "Worker Countered". | |
| **1.4** | **Turn Tennis** | 1. P counters -> W counters -> P counters. | - History array length = 3.<br>- Correct "Turn" shown at each step. | |
| **1.5** | **Ghost Notification** | 1. P counters.<br>2. W opens app. | - `hasNewCounter` flag clears after viewing.<br>- Badge disappears. | |

### Phase 2: Data Integrity (SQL Checks)

Run these queries in Supabase SQL Editor to check for anomalies.

#### Query 1: Detect Broken Negotiation Histories
```sql
-- Find bids where negotiation history exists but status implies no negotiation
SELECT id, status, negotiation_history 
FROM bids 
WHERE negotiation_history IS NOT NULL 
AND jsonb_array_length(negotiation_history) > 0
AND status = 'PENDING'
AND (negotiation_history->-1->>'by') IS NULL;
```

#### Query 2: Check for Self-Referential Last Turns
```sql
-- Find cases where the last turn 'by' matches the expected next actor incorrectly
-- (This requires joining with jobs to know who the poster is, simplified checks here)
```

## 4. Execution Plan

1. **Verify Triggers**: Run `sql/FIX_COUNTER_DUPLICATE_AND_SELF_NOTIFY.sql` (if not already done) to ensure backend base is solid.
2. **Run Manual Tests**: Execute the checklist above using the local dev environment (simulating two users).
3. **Analyze JobCard**: Deep dive into `JobCard.tsx` props `job.myBidLastNegotiationBy` vs `myBid.negotiationHistory`.
4. **Fix**: Apply fixes to `JobCard.tsx` if the "Your turn" bug persists.

## 5. Deliverables for this Audit
- [ ] `AUDIT_REPORT.md`: Completed checklist and findings.
- [ ] Code Fixes: PR/Commit for any identified bugs.
- [ ] SQL Patches: If data cleanup is needed.
