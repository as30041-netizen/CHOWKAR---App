# CHOWKAR Deep System Audit & Master Plan 🚀

## 1. 🎨 Premium UX & Visual Overhaul
*Goal: Transform app from "Functional" to "World Class Premium"*

### A. Visual Polish
- [ ] **Skeleton Loaders**: Replace all spinning circle loaders with "Shimmer" skeletons that mimic the content shape (Cards, Lists).
- [ ] **Micro-Interactions**:
    -   Heart/Like button explosions.
    -   "Ka-ching" sound/vibration when adding money.
    -   Confetti rain when a Job is accepted.
- [ ] **Transitions**:
    -   Page transitions (Slide left/right like iOS).
    -   Modal "Spring" animations (bouncy feel).
- [ ] **Typography**: Move from standard fonts to a premium Font Pair (e.g., *Clash Display* for headers, *Satoshi* for body).

### B. "Lifecycle" User Actions (The Gaps)
*Users must feel in control of their data.*
- [ ] **Chat**: Archive, Unarchive, Delete Message (Soft delete), Block User, Report.
- [ ] **Notifications**: Swipe to Dismiss, "Mark All as Read", Notification Settings (Toggle types).
- [ ] **Jobs**: Cancel Job (with refund logic), Clone/Repost Job, Share Job Link.
- [ ] **Bids**: Edit Bid (within 5 mins), Withdraw Bid (with reason).

---

## 2. 🗄️ Database & Data Integrity Strategy
*Goal: Prevent "Irrelevant Data" and bloat over the long term.*

### A. Archiving Strategy (The "Irrelevant Data" Fix)
*Problem: 10 years from now, do you need "accepted" notifications from 2024?*
- [ ] **Cron Job Cleanup**: Create a scheduled DB function to auto-delete:
    -   Notifications older than 90 days.
    -   Rejected bids on Completed jobs older than 6 months.
    -   Draft jobs never posted (older than 7 days).
- [ ] **Soft Deletes**:
    -   Add `deleted_at` column to `jobs`, `bids`, `chat_messages`.
    -   App filters `WHERE deleted_at IS NULL`.
    -   Allows restoring data if users complain (Accidental delete).

### B. Schema Optimizations
- [ ] **ENUMS**: Sync `types.ts` enums with Database strict `CHECK` constraints.
- [ ] **Indexes**: Verify indexes on `job_id`, `poster_id`, `worker_id` for chat messages (Crucial as chat grows).
- [ ] **Storage Buckets**: Implement auto-image resizing trigger (Edge Function) to prevent users uploading 10MB photos.

---

## 3. 🛡️ Critical Security & Backend Logic
*Goal: Bank-grade security for the Wallet.*

### A. The Critical Wallet Fix
-   **Current Risk**: Client updates `wallet_balance` directly.
-   **Fix**:
    1.  **Block Update**: RLS Policy to DENY updates to `wallet_balance` column.
    2.  **RPC Function**: create `process_transaction(user_id, amount, type)` function.
    3.  **Audit Log**: Every balance change MUST have a `transaction` record. Trigger ensures mathematical consistency (`NewBal = OldBal + TxAmount`).

### B. Admin & Safety Tools (Missing)
- [ ] **Admin Dashboard**:
    -   View reported users.
    -   Ban/Suspend logic (frozen wallet).
    -   Manually resolve disputes (Reverse transaction).
- [ ] **Dispute Flow**:
    -   "Report Issue" button on Active Jobs.
    -   Holds funds in Escrow state until resolved.

---

## 4. 📈 Execution Roadmap

| Phase | Focus | Key Deliverables |
| :--- | :--- | :--- |
| **1. Security (Urgent)** | **Wallet & Data** | Secure Wallet RPC, Fix RLS, Soft Delete Schema. |
| **2. Lifecycle (UX)** | **Control** | Delete/Archive Actions, Swipe Gestures, Undo Toast. |
| **3. Polish (Premium)** | **Visuals** | Animations, Skeletons, Sound FX, Premium Fonts. |
| **4. Scale (Backend)** | **Integrity** | Archiving Cron Jobs, Image Optimization, Pagination. |

---

## 💡 Recommendation
Start with **Phase 2 (Lifecycle Actions)** alongside **Phase 1 (Wallet Security)**.
The Visual Polish (Phase 3) is fun but the "Lifecycle" fix solves the immediate user frustration ("I can't clear notifications").

**Shall we proceed with Phase 1 & 2 together?**
