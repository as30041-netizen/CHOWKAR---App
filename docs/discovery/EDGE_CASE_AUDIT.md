# System Edge Case Audit & Resilience Plan

## Objective
Identify and verify handling of critical "Edge Cases" where user actions might conflict with system state, lead to data corruption, or cause bad UX.

## 1. Job & Bidding Lifecycle

### A. The "Ghost Bid" (Stale State)
- **Scenario:** Worker withdraws their bid (or is rejected). Poster's UI hasn't refreshed. Poster clicks "Accept".
- **Risk:** Accepted bid ID refers to a rejected/deleted bid. Job enters broken state.
- **Check Needs:** Does `accept_bid` RPC check if bid is still `PENDING`?

### B. The "Double Hire" (Race Condition)
- **Scenario:** Poster opens app on Phone and Laptop. Clicks "Accept" on Worker A on Phone, and "Accept" on Worker B on Laptop simultaneously.
- **Risk:** Job has `accepted_bid_id` = Worker B, but Worker A got a "You are hired" notification.
- **Check Needs:** Does `accept_bid` RPC enforce `status = OPEN` constraint atomically?

### C. The "Zombie Job"
- **Scenario:** Poster deletes job. Worker (viewing cached feed) clicks "Bid Now".
- **Risk:** Error throw, or (worse) phantom bid created on non-existent job.
- **Check Needs:** Foreign key constraints usually handle this, but UI should fail gracefully.

## 2. Negotiation Complexity

### A. The "Infinite Counter"
- **Scenario:** Poster counters -> Worker Counters -> Poster Counters... forever.
- **Risk:** Negotiation history array explodes in size.
- **Mitigation:** Is there a limit? (Low priority, but good to know).

### B. The "Late Agreement"
- **Scenario:** Poster Counters. Worker waits 1 week. Job is effectively dead/ignored. Worker clicks "Accept".
- **Risk:** Poster moved on.
- **Check Needs:** Should counters expire?

## 3. Chat & Communication

### A. The "Blocked Sender"
- **Scenario:** User A blocks User B. User B sends message from cached chat interface.
- **Risk:** Message sent to DB but invisible? Or rejected?
- **Check Needs:** RLS Policy for `INSERT` on `chat_messages` should check block status.

### B. The "Post-Completion" Spam
- **Scenario:** Job is completed. Worker/Poster keeps spamming chat (harassment).
- **Check Needs:** Is there a way to "Lock" chat after X days of completion?

## 4. Payment & Wallets (If implemented)
*Auditor Note: Wallets not fully visible in current snippets, assuming future scope.*

## 5. Offline & Network

### A. The "Tunnel" Action
- **Scenario:** User loses internet. Clicks "Accept Bid". Implementation uses `await`.
- **User Exp:** Spinner spins forever? Or proper timeout/error?
- **Check Needs:** `safeFetch`/`safeRPC` timeout configuration.

---

## Action Plan
1.  **Verify `accept_bid` RPC:** Ensure strict state checks (Job OPEN, Bid PENDING).
2.  **Verify Chat Block RLS:** Ensure blocked users cannot insert messages.
3.  **Verify Offline Handling:** Check timeout logic in `fetchUtils.ts`.
