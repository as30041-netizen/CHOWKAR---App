# Chat Feature Audit Plan

## Objective
To ensure the Chat feature is robust, secure, and provides a seamless user experience, specifically focusing on message delivery, notification synchronization, and data integrity.

## Scope
*   **Frontend Components:** `ChatInterface.tsx`, `ChatList.tsx`
*   **Services:** `chatService.ts` (API calls, `safeFetch` usage)
*   **Backend:** SQL Triggers for chat notifications, RLS policies for `chat_messages`.
*   **Realtime:** Supabase Realtime subscriptions for new messages.

## Audit Checklist

### 1. Code Quality & Safety (High Priority)
- [ ] **safeFetch Usage:** Verify `chatService.ts` uses `safeFetch` for all API calls to prevent auth hangs.
- [ ] **Error Handling:** Check how failed message sends are handled (retry logic, UI feedback).
- [ ] **Race Conditions:** Analyze `useEffect` in `ChatInterface.tsx` for potential multiple subscriptions or race conditions.

### 2. Notifications & Realtime
- [ ] **Notification Trigger:** Verify `trg_notify_on_chat_message` exists and correctly acts on *every* insert.
- [ ] **Push Sync:** Confirm chat notifications trigger the FCM push logic (already improved in previous step, but verify integration).
- [ ] **"Read" Status:** Verify logic for marking messages as read. Does entering the chat clear the notifications?
- [ ] **Ghost Notifications:** Ensure users don't get notified for their *own* messages.

### 3. Data Integrity & Security
- [ ] **RLS Policies:** Verify users can only read messages for jobs they are part of (Poster or Worker).
- [ ] **Input Validation:** Check for basic sanitization (though less critical with React/Supabase).

### 4. UX & Performance
- [ ] **Optimistic Updates:** Does the UI show the message *immediately* before the server responds?
- [ ] **Scroll to Bottom:** Does the chat auto-scroll to the newest message on load and on receipt?
- [ ] **Loading States:** Are loading indicators visible and accurate?

## Execution Strategy
1.  **Static Analysis:** Review `chatService.ts` first for `safeFetch`.
2.  **Database check:** Inspect SQL triggers for chat.
3.  **Component Review:** Analyze `ChatInterface.tsx` for hook logic.
4.  **Report:** Summarize findings and required fixes.
