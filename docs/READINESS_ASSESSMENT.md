# Codebase Readiness Assessment (Refined Business Plan)

This document outlines the current state of the codebase versus the requirements of the **"Hybrid Freemium" Business Plan**.

## 1. Database Schema (`Supabase`)

| Feature | Current State | Gap | Action Required |
| :--- | :--- | :--- | :--- |
| **Subscriptions** | ❌ Missing | No `user_subscriptions` table. No logic to track Start/End dates or Plan Type. | **Critical:** Create schema. |
| **Reviews** | ❌ Missing | No `reviews` table. Ratings are currently hardcoded or basic columns on `profile`. | **Critical:** Create schema. |
| **Categories** | ⚠️ Partial | `constants.ts` is updated, but DB `categories` table (if used for dynamic loading) might be stale. | **Medium:** Sync DB categories. |
| **Verification** | ❌ Missing | No `verification_requests` table (Aadhaar/Selfie upload). | **High:** Create schema. |

## 2. Frontend UI/UX

| Component | Current State | Gap | Action Required |
| :--- | :--- | :--- | :--- |
| **Wallet Page** | ⚠️ Updates Needed | Look & Feel is "Payment First" (Big Balance, Top Up). Needs to emphasize "Subscription Status". | **Medium:** Redesign to "Membership Card" style. |
| **Bid Modal** | ✅ Ready | Updated to remove fee checks. Free bidding logic is active. | None. |
| **View Bids** | ✅ Ready | Updated to remove fee checks. Poster pays 0 fees on accept. | None. |
| **Job Details** | ✅ Ready | No fee logic found. "Accept" actions are clean. | None. |
| **Home Screen** | ⚠️ Updates Needed | Current category rail might not support 30+ items well. | **Medium:** Implement "Zone" or "Grid" view. |

## 3. Backend Logic (Edge Functions/RPC)

| Function | Current State | Gap | Action Required |
| :--- | :--- | :--- | :--- |
| `place_bid` | ✅ Ready | Fee deduction removed. | None. |
| `accept_bid` | ✅ Ready | Fee deduction removed. | None. |
| `create_subscription`| ❌ Missing | No backend logic to handle Razorpay Webhook -> DB update. | **Critical:** Create Edge Function. |
| `check_limit` | ❌ Missing | No logic to enforce "3 Free Posts" limit. | **Critical:** Implement RLS or RPC check. |

---

## 🏗️ Execution Plan (Phase 1)

### Step 1: Schema Updates (The Foundation)
1.  Run `PHASE1_SCHEMA.sql` to create `subscriptions`, `reviews`, and `verification_requests`.
2.  Update `profiles` table to add `plan_id`, `verified_status`.

### Step 2: Subscription System (The Revenue)
1.  Create `SubscriptionModal.tsx` (Plan Selection).
2.  Integrate Razorpay Subscription Flow.
3.  Update **Wallet Page** to show "Active Plan" instead of just "Coin Balance".

### Step 3: Trust & Safety (The Product)
1.  Build **Review Flow**: Modal pops up after `JobStatus.COMPLETED`.
2.  Build **Verification UI**: Simple file upload for ID card.

### Recommended First Task
**Step 1: Schema Updates**. We cannot build the UI without the database tables.
