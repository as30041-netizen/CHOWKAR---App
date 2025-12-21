# Phase 3: Testing Plan & Strategy

## 1. Test Strategy Overview
We will validate the application by simulating real-world user journeys end-to-end. This involves acting as both the **Customer** (Poster) and the **Service Provider** (Worker) across three key scenarios.

## 2. Critical Test Scenarios

### 2.1 Scenario A: The Happy Path (Standard Flow)
1.  **Job Posting**: User A posts a "Plumbing Repair" job.
2.  **Discovery**: User B (Worker) finds the job in the feed.
3.  **Bidding**: User B places a bid of ₹500.
4.  **Acceptance**: User A accepts the bid.
5.  **Payment**: User A pays the connection fee (simulated).
6.  **Chat**: Both users exchange messages (text + media).
7.  **Completion**: User A marks job as complete.
8.  **Review**: User A reviews User B.

### 2.2 Scenario B: Negotiation & Multi-Bidder
1.  **Engagement**: User A posts a job.
2.  **Bid 1**: User B bids ₹1000.
3.  **Bid 2**: User C bids ₹800.
4.  **Counter-Offer**: User A counters User B with ₹900.
5.  **Acceptance**: User B accepts the counter-offer.
6.  **Verification**:
    *   User B gets "Job Accepted" notification.
    *   User C gets "Job Closed" notification.
    *   Job status updates to `IN_PROGRESS`.

### 2.3 Scenario C: Cancellation & Refunds
1.  **Cancellation**: User A posts a job, accepts a bid, then cancels.
2.  **Refund Verification**: Ensure correct refund logic is triggered (if applicable).
3.  **Withdrawal**: Worker withdraws from an active job (verify penalty/notification).

## 3. Pre-Requisites
*   Ensure `FINAL_MULTI_BID_FIX.sql` is executed.
*   Ensure `FIX_CHAT_SCHEMA_AND_RPC.sql` is executed.
*   Use two different browser sessions or devices (or Incognito mode) to simulate two users.

## 4. Execution Log

| Scenario | Status | Notes |
| :--- | :--- | :--- |
| A. Happy Path | ⏳ Pending | |
| B. Negotiation | ⏳ Pending | |
| C. Cancellation | ⏳ Pending | |

## 5. Next Steps
Start with **Scenario A: The Happy Path**.
