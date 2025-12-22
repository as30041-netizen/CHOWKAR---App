# Full Codebase Audit & Refactoring Plan - CHOWKAR App

## 1. Type Definitions (Critical)
- [x] **File**: `lib/supabase.ts` (or `types.ts` if better suited)
- [x] **Issue**: The `Database` interface is incomplete. It lacks definitions for `chat_messages`, `notifications`, `bids` (partially missing `connection_payment_status`), and `users` (missing `ai_usage_count`, `is_premium`).
- [x] **Action**: Update the `Database` type definition to match the actual Supabase schema usage found in the code.
- [x] **Status**: Completed.

## 2. Notification System Refactoring (Major)
- [x] **File**: `components/NotificationsPanel.tsx`
- [x] **Issue**: Hardcoded English/Hindi strings (e.g., "Clear all notifications?", "No notifications yet").
- [x] **Action**: Move all strings to `constants.ts` (TRANSLATIONS). Use `t.clearAll`, `t.noNotifications` etc.
- [x] **Status**: Completed.

## 3. Job Posting Form Refactoring (Major)
- [x] **File**: `components/JobPostingForm.tsx` & `pages/PostJob.tsx`
- [x] **Issue**: Massive amount of hardcoded strings in alert messages and UI labels. Nested ternaries for language checks are unreadable.
- [x] **Examples**:
    - "Cannot edit a job that is in progress..."
    - "Job posted! ₹{fee} deducted from wallet."
    - "Voice input is not supported..."
- [x] **Action**:
    - Create keys in `constants.ts`: `alertJobInProgress`, `jobPostedDeduction`, `voiceNotSupported`.
    - Refactor `JobPostingForm` to use `t.key`.
- [x] **Status**: Completed.

## 4. UI Component Localization (Moderate)
- [x] **File**: `components/JobCard.tsx`
- [x] **Issue**:
    - "Withdraw" (Button) hardcoded.
    - "Rate" (Button) hardcoded fallback.
    - "Today" date formatting is hardcoded in English/Hindi ternary.
- [x] **Action**: Add `withdraw`, `rate`, `today` to translations.
- [x] **Status**: Completed.

- [x] **File**: `components/JobDetailsModal.tsx`
- [x] **Issue**:
    - "Cancel job and refund fees?" (Confirm dialog)
    - "Are you sure you want to delete this job?"
    - "Bids Received" header.
- [x] **Action**: Add `cancelJobPrompt`, `deleteJobPrompt`, `bidsReceived` to translations.
- [x] **Status**: Completed.

## 5. Wallet & Payment Alerts (Low)
- [x] **File**: `App.tsx` (Logic for handling payments often resides here or passed down)
- [x] **Issue**: Alerts for "Payment successful! Chat unlocked" are often hardcoded.
- [x] **Action**: Audit `App.tsx` for `showAlert` calls and localize them.
- [x] **Status**: Completed.

## 6. General Cleanup
- [x] **File**: `constants.ts`
- [x] **Action**: Organize `TRANSLATIONS` object better (group by feature: Auth, Job, Wallet, Errors).
- [x] **Status**: Completed.
