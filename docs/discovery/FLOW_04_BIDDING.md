# Flow 4: Bidding (Worker) - Detailed Documentation

> **Purpose**: Complete documentation of the worker bidding flow in CHOWKAR
> **Status**: ✅ COMPLETE
> **Last Updated**: 2025-12-21

---

## Overview

Workers can bid on open jobs to offer their services. The bidding process is **free** for workers - they only pay a connection fee if their bid is accepted and they want to unlock chat.

---

## Questions & Answers

| # | Question | Answer |
|---|----------|--------|
| 4.1 | What is required to place a bid? | **Bid amount** (required, must be > 0), **Message** (optional, can be AI-enhanced) |
| 4.2 | Is there a minimum/maximum bid amount? | **Minimum: ₹1** (validated in frontend), **No maximum** (by design) |
| 4.3 | Can worker bid below the poster's budget? | **Yes** - Workers can bid any positive amount. Budget is shown as reference. |
| 4.4 | Is a message required with bid? | **No** - Message is optional but recommended. AI enhancement available. |
| 4.5 | Can worker edit their bid after submission? | **No** - Workers cannot directly edit. Counter-offer during negotiation is the mechanism. |
| 4.6 | Can worker withdraw their bid? When? | **Yes** - Only **PENDING** bids can be withdrawn. Via RPC `withdraw_from_job` or direct deletion. |
| 4.7 | What happens when bid is submitted? | DB insert → Trigger `on_bid_created_notify` → Poster notification → Push notification |
| 4.8 | Can worker bid on multiple jobs simultaneously? | **Yes** - No limit on total bids across different jobs |
| 4.9 | Is there a limit on bids per worker? | **One bid per job** - Frontend prevents duplicate bids with validation |
| 4.10 | What status values exist for bids? | **PENDING**, **ACCEPTED**, **REJECTED** (also **WITHDRAWN**, **EXPIRED** in DB) |

---

## Technical Implementation

### Files Involved

| File | Purpose |
|------|---------|
| `components/BidModal.tsx` | UI for placing bids with validations |
| `components/JobCard.tsx` | Shows bid status, counter-offer UI, withdraw button |
| `components/ViewBidsModal.tsx` | Poster view of all bids on a job |
| `services/jobService.ts` | `createBid()`, `updateBid()` functions |
| `contexts/JobContextDB.tsx` | `addBid()`, realtime bid subscriptions |
| `types.ts` | `Bid`, `NegotiationEntry` interfaces |
| `CREATE_ALL_RPC_FUNCTIONS.sql` | `withdraw_from_job`, `accept_bid` RPCs |

### Bid Object Structure

```typescript
interface Bid {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  workerRating: number;
  workerLocation: string;
  workerCoordinates?: Coordinates;
  workerPhoto?: string;
  amount: number;            // Current active bid amount
  message: string;           // Optional message to employer
  createdAt: number;         // Timestamp
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  negotiationHistory: NegotiationEntry[];  // Track negotiation
  posterId?: string;         // Denormalized for RLS
}
```

### Validation Rules (✅ Fixed in this session)

1. **Duplicate Bid Prevention**: Worker cannot bid again on a job they already bid on
2. **Amount Validation**: Bid amount must be > 0
3. **UI Feedback**: Shows existing bid warning and employer's budget as reference

---

## Flow Diagram

```
[Worker Views Job] → [Clicks "Bid Now"]
          ↓
[BidModal Opens]
          ↓
[Shows Job Budget Reference: ₹X]
          ↓
[Worker Enters Amount + Optional Message]
          ↓
[Optional: AI Enhance Message]
          ↓
[Clicks "Send Bid"]
          ↓
     ┌─────────────────────────────────────────┐
     │               VALIDATIONS                │
     ├─────────────────────────────────────────┤
     │ ❶ Already bid on this job? → ERROR      │
     │ ❷ Amount ≤ 0? → ERROR                   │
     │ ❸ Job not found? → ERROR                │
     └─────────────────────────────────────────┘
          ↓ (All pass)
[createBid() → Supabase INSERT]
          ↓
[DB Trigger: on_bid_created_notify]
          ↓
[Notification Created for Poster]
          ↓
[Push Notification Sent (if configured)]
          ↓
[Worker sees: "Bid placed successfully!"]
          ↓
[JobCard shows: "Pending: ₹X" with Withdraw option]
```

---

## Bid States & Transitions

```
                    ┌──────────────┐
                    │   PENDING    │ ← Initial state
                    └──────────────┘
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │   ACCEPTED   │ │   REJECTED   │ │  WITHDRAWN   │
   └──────────────┘ └──────────────┘ └──────────────┘
          │                                │
          │ (If no payment in 24h)         │ (By worker)
          ↓                                │
   ┌──────────────┐                        │
   │   EXPIRED    │ ←──────────────────────┘
   └──────────────┘
```

---

## Notification Flow

| Event | Trigger | Recipient | Message |
|-------|---------|-----------|---------|
| New Bid | `on_bid_created_notify` | Poster | "New Bid: Worker offered ₹X for Job" |
| Bid Withdrawn | Frontend deletion | Poster | "Bid Update: Worker no longer available" |

---

## UI Components

### BidModal Features

- **Employer's Budget Display**: Shows the job budget as reference for workers
- **Existing Bid Warning**: If user already bid, shows warning with status
- **AI Enhancement**: Optional Gemini-powered message improvement
- **Amount Input**: Number field with min=1, placeholder shows job budget
- **Free Bidding Note**: Explains no upfront cost, only connection fee on acceptance
- **Disabled State**: Button disabled if already bid

### JobCard Worker Status Display

| Status | UI Display |
|--------|------------|
| PENDING | Blue badge: "Pending: ₹X" + Withdraw button |
| PENDING (awaiting poster response) | Blue badge: "Waiting for Response: ₹X" |
| PENDING (counter-offer received) | Amber badge: "Poster Countered: ₹X" + Accept/Counter/Reject buttons |
| ACCEPTED | Green badge: "Hired: ₹X" |
| REJECTED | Red badge: "Declined" |

---

## Database & RPC

### bids Table Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| job_id | UUID | Foreign key to jobs |
| worker_id | UUID | Foreign key to profiles |
| worker_name, worker_phone, etc. | TEXT | Denormalized worker info |
| amount | INTEGER | Current bid amount |
| message | TEXT | Optional worker message |
| status | TEXT | PENDING/ACCEPTED/REJECTED |
| negotiation_history | JSONB | Array of {amount, by, timestamp} |
| connection_payment_status | TEXT | NOT_REQUIRED/PENDING/PAID |
| accepted_at | TIMESTAMPTZ | When bid was accepted |

### RPC Functions

| Function | Purpose | Called When |
|----------|---------|-------------|
| `withdraw_from_job(p_job_id, p_bid_id)` | Worker withdraws pending bid | Worker clicks "Withdraw" |
| `check_expired_bid_deadlines()` | Expire bids that missed 24h payment | Periodic check |

---

## Issues Fixed (This Session)

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| No duplicate bid prevention | 🔴 Critical | Added validation - prevents double bids on same job |
| No bid amount validation | 🟡 Medium | Added min > 0 check with error message |
| No budget reference | 🟢 Low | Added employer's budget display in modal |
| Confusing disabled state | 🟢 Low | Button shows "Already Bid" when disabled |
| Duplicate placeholder attribute | 🟡 Medium | Fixed in JobDetailsModal line 70 (build error) |
| No counter offer validation | 🟡 Medium | Added to CounterModal, JobDetailsModal, JobCard |

---

## Remaining Considerations (By Design)

| Item | Decision | Rationale |
|------|----------|-----------|
| No max bid limit | By Design | Workers can bid any amount; market determines value |
| Message optional | By Design | Lower friction for quick bids |
| No bid editing | By Design | Counter-offers handle negotiation cleanly |

---

## Test Scenarios

1. ✅ **Place first bid** - Worker can bid successfully
2. ✅ **Prevent duplicate** - Same worker cannot bid again on same job
3. ✅ **Amount validation** - Bid of 0 or negative shows error
4. ✅ **Budget reference** - Worker sees employer's budget in modal
5. ✅ **Existing bid warning** - Modal shows previous bid amount and status
6. ✅ **Withdraw pending bid** - Worker can withdraw before acceptance
7. ✅ **Bid on multiple jobs** - No limit across different jobs
8. ✅ **Poster notification** - Poster receives notification on new bid
