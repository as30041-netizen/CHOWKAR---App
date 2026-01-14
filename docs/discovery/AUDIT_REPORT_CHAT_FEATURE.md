# Chat Feature Audit Report

## Executive Summary
The Chat feature was audited for reliability, security, and user experience. The audit revealed two critical issues:
1.  **Duplicate Notifications:** Multiple database triggers were firing for the same message, likely causing users to receive double/triple notifications (In-app and Push).
2.  **Unsafe API Usage:** The `chatService.ts` was using the raw Supabase client for some operations, which could cause the application to hang if the user's session token expired.

Both issues have been addressed. The system now has a single, canonical notification trigger and uses a robust `safeFetch` mechanism for all API interactions.

## Findings & Fixes

### 1. Duplicate Notifications
*   **Issue:** Diagnostic analysis revealed multiple triggers (`trg_notify_on_new_message`, `trigger_notify_on_chat_message`, `on_chat_message_created`) potentially active on the `chat_messages` table.
*   **Fix:** Created and executed `FIX_CHAT_TRIGGERS_FINAL.sql`.
    *   **Action:** Dropped all conflicting triggers.
    *   **Action:** Installed a single canonical trigger `trigger_notify_on_chat_message`.
    *   **Improvement:** Added logic to check for **User Blocking** relationships before sending notifications.
    *   **Improvement:** Added "Self-Notification" prevention (Sender never gets a notification).

### 2. Unsafe API Calls (Stability)
*   **Issue:** `fetchLastMessage` and `editMessage` used `supabase.from()`. If the Auth Session was stale, these promises could hang indefinitely, freezing the UI.
*   **Fix:** Refactored `services/chatService.ts`.
    *   **Action:** Replaced direct calls with `safeFetch` (for REST) and `safeRPC` (for functions).
    *   **Result:** The app now automatically refreshes tokens or fails gracefully with an error, preventing UI freezes.

### 3. Data Retention vs Privacy (Delete Functionality)
*   **Issue:** Previous "Soft Delete" logic was overwriting the message text with "This message was deleted", destroying data valuable for business analytics.
*   **Fix:** implemented a **Secure View Strategy**.
    *   **Database:** `soft_delete_chat_message` now **preserves** the original text in the `chat_messages` table (setting `is_deleted = TRUE`).
    *   **Privacy:** Created `view_chat_messages` which dynamically masks the text (returning "🚫 This message was deleted") if the flag is set.
    *   **Application:** Updated `chatService.ts` to fetch from this Secure View, ensuring users never see the deleted text, while the database retains it for admin/analytics.
    *   **Inbox:** Updated `get_inbox_summaries` RPC to respect this masking rule for usage in the chat list preview.

### 4. Message Visibility & Security
*   **Status:** Verified that Row Level Security (RLS) policies exist to ensure only the Sender and Receiver can view their messages.
*   **Status:** Confirmed `soft_delete_chat_message` functionality allows users to delete messages from their view without breaking the thread for the other party.

## Verification Checklist

To confirm the fixes are successful, please perform the following tests:

### Test 1: Notification Duplication
1.  Open the app as **User A**.
2.  Send a message to **User B**.
3.  **Check User B:**
    *   **Expectation:** Receive **EXACTLY ONE** notification (In-app or Push).
    *   **Failure:** Receiving 2+ notifications for the same message.

### Test 2: Thread Functionality
1.  Open the Chat as **User B** (Receiver).
2.  **Expectation:** The new message should appear.
3.  **Action:** Reply to User A.
4.  **Expectation:** User A receives **ONE** notification.

### Test 3: Blocking Logic
1.  **User A** blocks **User B**.
2.  **User B** sends a message to **User A**.
3.  **Expectation:** User A should **NOT** receive a notification.

### Test 4: App Stability
1.  Reload the page / Restart the app.
2.  Go to Inbox.
3.  **Expectation:** Inbox loads immediately without hanging (verifies `safeFetch` on `get_inbox_summaries`).
