# Audit & Plan: Multi-Bidder Scenarios

## 1. Audit Findings

### 1.1 Race Conditions in Bid Acceptance
*   **Mechanism**: The `accept_bid` RPC is the single source of truth for accepting a bid.
*   **Status**: ✅ **Robust**.
*   **Logic Verified**:
    *   Verifies job is `OPEN` before proceeding.
    *   Updates the accepted bid to `ACCEPTED`.
    *   **Crucially**, updates all *other* `PENDING` bids on the same job to `REJECTED`.
    *   Updates job status to `IN_PROGRESS`.
*   **Conclusion**: Even if two posters try to accept different bids simultaneously (unlikely), the first transaction will succeed, and the second will fail because the job status will no longer be `OPEN`.

### 1.2 Concurrent Bidding (Two Workers Bid at Once)
*   **Mechanism**: `createBid` service inserts into `bids` table.
*   **Status**: ⚠️ **RLS Gap Identified**.
*   **Gap**: The current RLS policy for `INSERT` on `bids` allows a worker to bid on *any* job they don't own, regardless of the job's status.
*   **Risk**: A worker could place a bid on a job that has just been marked `IN_PROGRESS` if their UI is stale.
*   **Proposed Fix**: Update `bids` RLS to enforce `EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND status = 'OPEN')`.

### 1.3 Real-Time Updates (Frontend)
*   **Mechanism**: `ViewBidsModal.tsx` subscribes to `postgres_changes` on `bids`.
*   **Status**: ✅ **Functionally Correct**.
*   **Logic**:
    *   Listens for `INSERT`: Adds new bid to the list live.
    *   Listens for `UPDATE`: Updates status (e.g. if rejected by RPC).
    *   Listens for `DELETE`: Removes bid.

## 2. Issue Identification & Validation Plan

### 2.1 Scenario: "The Late Bidder"
*   **Setup**: Job is `OPEN`. Worker A bids. Poster accepts Worker A. Job -> `IN_PROGRESS`. Worker B (with stale UI) tries to bid.
*   **Current Outcome**: specific RLS allows it. Bid is inserted. Poster sees it?
*   **Desired Outcome**: Insert fails (RLS Violation). Worker B gets "Job is no longer open" error.

### 2.2 Scenario: "The Concurrent Accept"
*   **Setup**: Two admin tabs open? Or accidental double click.
*   **Current Outcome**: `accept_bid` checks `status = 'OPEN'`. First call sets it to `IN_PROGRESS`. Second call raises "Job is no longer open".
*   **Result**: Safe.

## 3. Implementation Plan (Fixes)

### 3.1 Step 1: Fix Bids RLS
Create and execute `FIX_BIDS_RLS_v2.sql`:
```sql
DROP POLICY IF EXISTS "Users can insert bids" ON bids;
CREATE POLICY "Users can insert bids"
ON bids FOR INSERT
WITH CHECK (
  auth.uid() = worker_id
  AND
  NOT EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND poster_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM jobs WHERE id = job_id AND status = 'OPEN') -- NEW CHECK
);
```

### 3.2 Step 2: Frontend Error Handling
*   Verify `createBid` in `jobService.ts` handles the RLS error gracefully.
*   Ensure `BidModal` displays a clear error if the bid fails (e.g., "Job is closed").

### 3.3 Step 3: Verification
*   Simulate "Late Bidder" scenario by manually setting job status to `IN_PROGRESS` and trying to insert a bid via SQL or App.
